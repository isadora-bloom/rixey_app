import { apiFetch } from './api'
import { API_URL } from '../config/api'

/**
 * Wait for an answer the server is still writing.
 *
 * The three slow AI routes no longer answer on the request. They hand back a
 * job id straight away and write the answer to the job row when Sonnet is done,
 * because a wedding with a full file takes a minute or two and Railway's proxy
 * hangs up at about fifty seconds. This is the other half: poll the job until
 * it has finished or failed, and tell the caller how long it has been so the
 * screen can say something truer than a spinner.
 *
 * Throws a plain Error on failure so a caller can show err.message as it is.
 *
 * @param {string} jobId
 * @param {object} opts
 * @param {(seconds: number, status: string) => void} [opts.onTick] called once a second
 * @param {number} [opts.intervalMs] how often to ask the server, default 3s
 * @param {number} [opts.timeoutMs] how long to keep asking, default 5 minutes
 * @returns {Promise<{ answer: string, elapsed_ms: number, finished_at: string }>}
 */
export async function awaitAnswerJob(jobId, { onTick, intervalMs = 3000, timeoutMs = 300000 } = {}) {
  if (!jobId) throw new Error('The server did not start that off. Try again.')

  const startedAt = Date.now()
  let nextPollAt = 0
  let status = 'running'

  for (;;) {
    const elapsed = Date.now() - startedAt
    if (elapsed > timeoutMs) throw new Error('Still working after five minutes')

    if (elapsed >= nextPollAt) {
      const job = await apiFetch(`${API_URL}/api/answer-jobs/${jobId}`)
      status = job?.status || 'running'
      if (status === 'finished') return job
      if (status === 'failed') {
        throw new Error(job?.error || 'That answer did not finish. Try again.')
      }
      nextPollAt = elapsed + intervalMs
    }

    // Tick every second rather than every poll: the counter on screen is the
    // only sign that anything is still happening, and one that jumps in threes
    // reads like a stall.
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (onTick) onTick(Math.round((Date.now() - startedAt) / 1000), status)
  }
}

/**
 * "2 minutes ago", for the last briefing on file.
 *
 * Short and rough on purpose. Whether the briefing was written at 14:02 or
 * 14:05 does not matter; whether it was written this morning or in March does.
 */
export function timeAgo(when) {
  const then = when ? new Date(when).getTime() : NaN
  if (!Number.isFinite(then)) return 'some time ago'

  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}
