/**
 * Turning a walkthrough voice note into text.
 *
 * Deepgram rather than Whisper, chosen for one reason: diarization. A final
 * walkthrough is a venue owner, a couple and often a parent, in a room with
 * echo, talking over each other. Whisper returns one undifferentiated wall of
 * text; Deepgram labels who spoke, which is the difference between a
 * transcript and something you can turn into meeting notes. Cost is close
 * enough either way to be irrelevant at this volume.
 *
 * Nothing here throws at the caller. A recording that cannot be transcribed is
 * still a recording, and the audio is already safely stored by the time this
 * runs — the transcript column simply stays null, which means "not
 * transcribed", never "nothing was said".
 */

const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen';

export function transcriptionConfigured() {
  return !!process.env.DEEPGRAM_API_KEY;
}

/**
 * Format Deepgram's diarized output into something readable.
 *
 * Speakers come back as indices, so they are rendered as "Speaker 1:" rather
 * than guessed at by name. Who is who is obvious to whoever was in the room
 * and impossible for us to know, and a wrong name in a transcript is worse
 * than a number.
 */
function formatDiarized(result) {
  const alt = result?.results?.channels?.[0]?.alternatives?.[0];
  if (!alt) return '';

  const paragraphs = alt.paragraphs?.paragraphs;
  if (Array.isArray(paragraphs) && paragraphs.length) {
    const lines = [];
    let lastSpeaker = null;
    for (const p of paragraphs) {
      const text = (p.sentences || []).map(s => s.text).join(' ').trim();
      if (!text) continue;
      const speaker = typeof p.speaker === 'number' ? p.speaker : null;
      if (speaker !== null && speaker !== lastSpeaker) {
        lines.push(`\nSpeaker ${speaker + 1}: ${text}`);
        lastSpeaker = speaker;
      } else {
        lines.push(text);
      }
    }
    return lines.join(' ').replace(/\n /g, '\n').trim();
  }
  return String(alt.transcript || '').trim();
}

/**
 * @param {Buffer} audio
 * @param {string} mimetype
 * @returns {Promise<{ ok: boolean, transcript?: string, durationSecs?: number, error?: string }>}
 */
export async function transcribeAudio(audio, mimetype) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return { ok: false, error: 'No DEEPGRAM_API_KEY configured' };

  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',   // punctuation, capitalisation, numbers as digits
    diarize: 'true',        // the reason for choosing Deepgram
    paragraphs: 'true',
    punctuate: 'true',
    filler_words: 'false',  // nobody needs the ums in a meeting note
  });

  try {
    const res = await fetch(`${DEEPGRAM_URL}?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${key}`,
        'Content-Type': mimetype || 'audio/webm',
      },
      body: audio,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `Deepgram ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = await res.json();
    const transcript = formatDiarized(json);
    if (!transcript) return { ok: false, error: 'Deepgram returned no words — the recording may be silent' };

    return {
      ok: true,
      transcript,
      durationSecs: Math.round(json?.metadata?.duration || 0) || undefined,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
