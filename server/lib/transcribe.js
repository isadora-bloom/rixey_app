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
 * runs. What the caller does with { ok: false, error } matters, though: it
 * writes the reason to walkthrough_media.transcript_error (migration 035) and
 * logs it against the media id. Before that column existed a failure left
 * transcript null, which is also what "queued" looks like and what "silent
 * recording" looks like, so a dead key was invisible.
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

const QUERY = {
  model: 'nova-2',
  smart_format: 'true',   // punctuation, capitalisation, numbers as digits
  diarize: 'true',        // the reason for choosing Deepgram
  paragraphs: 'true',
  punctuate: 'true',
  filler_words: 'false',  // nobody needs the ums in a meeting note
};

/** One place that knows how to read Deepgram's answer, whatever was sent to it. */
async function callDeepgram(key, headers, body) {
  const params = new URLSearchParams(QUERY);
  try {
    const res = await fetch(`${DEEPGRAM_URL}?${params}`, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, ...headers },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Deepgram ${res.status}: ${text.slice(0, 200)}` };
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

/**
 * @param {Buffer} audio
 * @param {string} mimetype
 * @returns {Promise<{ ok: boolean, transcript?: string, durationSecs?: number, error?: string }>}
 */
export async function transcribeAudio(audio, mimetype) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return { ok: false, error: 'No DEEPGRAM_API_KEY configured' };
  return callDeepgram(key, { 'Content-Type': mimetype || 'audio/webm' }, audio);
}

/**
 * Transcribe a recording that is already in storage, by handing Deepgram a link
 * to it rather than the bytes.
 *
 * A two-hour walkthrough is a few hundred megabytes. Reading it back out of the
 * bucket only to post it straight on again would hold all of that in this
 * process's memory for the length of the call, on a container sized for a web
 * server. Deepgram fetches remote audio itself, so the only thing that has to
 * travel from here is the URL.
 *
 * The URL must be reachable without a Rixey session. A signed storage URL is
 * what the caller passes; it expires, which matters because it is a link to a
 * private conversation between a couple and the venue.
 *
 * @param {string} url  a link Deepgram can fetch, signed and short-lived
 * @returns {Promise<{ ok: boolean, transcript?: string, durationSecs?: number, error?: string }>}
 */
export async function transcribeAudioFromUrl(url) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return { ok: false, error: 'No DEEPGRAM_API_KEY configured' };
  if (!url) return { ok: false, error: 'No audio URL to transcribe' };
  return callDeepgram(key, { 'Content-Type': 'application/json' }, JSON.stringify({ url }));
}
