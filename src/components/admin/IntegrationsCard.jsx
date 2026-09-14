import { useEffect, useRef, useState } from 'react'

/**
 * Gmail, the phone line and Zoom, as three rows.
 *
 * They were three cards carrying nine buttons and a paragraph each, and
 * between them they said "Connected" in green nine times a day whether or not
 * a single run had worked. Connected is a fact about a token. What she needs
 * to know is whether the last run did anything, and the only place that was
 * ever written down was the sync history at the bottom of the column.
 *
 * So each row now says the last run and its result in one grey line, carries
 * one Sync button, and keeps the rare things (force resync, re-auth, recover
 * missing bodies, disconnect) behind an overflow. Nothing was dropped. The
 * sync history is the same list, behind the History link in the header.
 *
 * The dot: green connected, grey not connected, amber when the last run
 * failed or stopped partway. Red is kept for the error text itself.
 */

function timeLabel(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * The newest job for one integration. Gmail writes 'gmail' and
 * 'gmail-backfill', the phone line writes 'quo', 'quo-backfill' and
 * 'quo-callers', so match on the prefix rather than the exact kind.
 */
function lastJobFor(jobs, prefix) {
  return (jobs || []).find(j => String(j.kind || '').startsWith(prefix)) || null
}

/**
 * One line: what happened last, and when. The live status string from a run
 * in progress wins, because it is newer than anything on file.
 */
function lastRunLine({ liveStatus, connected, notConnectedBlurb, statusInfo, job }) {
  if (liveStatus) return { text: liveStatus, failed: /fail|error|could not|not connected|stopped/i.test(liveStatus) }

  const status = statusInfo?.last_status || (job?.stalled ? 'stalled' : job?.status) || null
  const when = timeLabel(statusInfo?.last_finished_at || job?.finished_at || job?.started_at)
  const error = statusInfo?.last_error || job?.last_error || null

  // A run that failed is reported whether or not the token is still good.
  // "Failed 4:05 PM: Gmail is not connected" is exactly the case where the
  // connection is gone and the last run is the thing worth saying.
  if (status === 'failed') return { text: `Failed${when ? ` ${when}` : ''}${error ? `: ${error}` : ''}`, failed: true }
  if (status === 'stalled') return { text: `Stopped partway${when ? ` ${when}` : ''}${job?.processed ? `, ${job.processed} processed` : ''}`, failed: true }

  if (!connected) return { text: notConnectedBlurb, failed: false }
  if (!status) return { text: 'Connected. No sync recorded yet.', failed: false }
  if (status === 'running') return { text: `Running${when ? `, started ${when}` : ''}`, failed: false }
  return {
    text: `Synced${when ? ` ${when}` : ''}${job?.processed != null ? `, ${job.processed} processed` : ''}`,
    failed: false,
  }
}

function Dot({ connected, failed }) {
  const colour = failed ? 'bg-amber-500' : connected ? 'bg-green-500' : 'bg-sage-200'
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colour}`} />
}

function Overflow({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const usable = items.filter(Boolean)
  if (usable.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="px-1.5 py-1.5 text-sage-400 hover:text-sage-700 rounded-lg hover:bg-cream-50"
        title="More"
        aria-label="More actions"
        aria-expanded={open}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-cream-200 rounded-xl shadow-lg z-20 py-1">
          {usable.map(item => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.onClick() }}
              disabled={item.disabled}
              title={item.title}
              className="w-full text-left px-3 py-2 text-sm text-sage-600 hover:bg-cream-50 disabled:opacity-40"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ name, connected, failed, line, busy, primary, menu, children }) {
  return (
    <div className="px-4 py-3 border-t border-cream-100 first:border-t-0">
      <div className="flex items-center gap-2">
        <Dot connected={connected} failed={failed} />
        <span className="text-sm font-medium text-sage-700 flex-1 min-w-0">{name}</span>
        {primary && (
          <button
            onClick={primary.onClick}
            disabled={busy}
            className="px-3 py-1.5 bg-sage-600 text-white rounded-lg text-xs hover:bg-sage-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : primary.label}
          </button>
        )}
        <Overflow items={menu || []} />
      </div>
      {line?.text && (
        <p className={`text-xs mt-1 ml-4 whitespace-pre-wrap ${line.failed ? 'text-red-600' : 'text-sage-400'}`}>
          {line.text}
        </p>
      )}
      {children}
    </div>
  )
}

export default function IntegrationsCard({
  syncJobs = [],
  syncJobsLoading,
  syncJobsError,
  reloadSyncJobs,
  historyOpen,
  setHistoryOpen,
  // Gmail
  gmailConnected,
  gmailCanSend = true,
  gmailSyncing,
  gmailStatus,
  gmailInfo,
  connectGmail,
  syncEmails,
  recoverEmailBodies,
  bodyBackfillPlanned,
  disconnectGmail,
  // Phone & SMS
  quoConnected,
  quoSyncing,
  quoStatus,
  quoInfo,
  syncQuo,
  sweepCallers,
  // Zoom
  zoomConnected,
  zoomSyncing,
  zoomStatus,
  zoomInfo,
  connectZoom,
  syncZoom,
  reextractZoom,
  clearZoom,
  disconnectZoom,
}) {
  const gmailJob = lastJobFor(syncJobs, 'gmail')
  const quoJob = lastJobFor(syncJobs, 'quo')
  const zoomJob = lastJobFor(syncJobs, 'zoom')

  const gmailLine = lastRunLine({
    liveStatus: gmailStatus,
    connected: gmailConnected,
    notConnectedBlurb: 'Not connected. Connect to read past and incoming email from registered clients, and pull planning notes out of it.',
    statusInfo: gmailInfo,
    job: gmailJob,
  })
  const quoLine = lastRunLine({
    liveStatus: quoStatus,
    connected: quoConnected,
    notConnectedBlurb: 'Not connected. Add QUO_API_KEY to .env to enable SMS sync.',
    statusInfo: quoInfo,
    job: quoJob,
  })
  const zoomLine = lastRunLine({
    liveStatus: zoomStatus,
    connected: zoomConnected,
    notConnectedBlurb: zoomInfo?.reason || 'Not connected. Connect to sync meeting transcripts for planning notes.',
    statusInfo: zoomInfo,
    job: zoomJob,
  })

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cream-100">
        <h3 className="font-medium text-sage-700 text-sm flex-1">Integrations</h3>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          aria-expanded={historyOpen}
          className="text-xs text-sage-400 hover:text-sage-600"
        >
          {historyOpen ? 'Hide history' : 'History'}
        </button>
      </div>

      <Row
        name="Gmail"
        connected={gmailConnected}
        failed={gmailLine.failed}
        line={gmailLine}
        busy={gmailSyncing}
        primary={gmailConnected
          ? { label: 'Sync', onClick: syncEmails }
          : { label: 'Connect', onClick: connectGmail }}
        menu={gmailConnected ? [
          {
            label: bodyBackfillPlanned ? 'Recover them now' : 'Recover missing bodies',
            onClick: () => recoverEmailBodies(bodyBackfillPlanned),
            disabled: gmailSyncing,
            title: 'Re-read emails that came in with an empty body, usually because they had a document attached',
          },
          { label: 'Disconnect', onClick: disconnectGmail },
        ] : []}
      >
        {/* Reading and sending are separate permissions, and the old card only
            ever reported the first. It said Connected in green while every
            email the portal tried to send was refused for want of a scope
            nobody had asked Google for. */}
        {gmailConnected && !gmailCanSend && (
          <p className="text-xs text-amber-700 mt-1 ml-4">
            Reading email, but not allowed to send it. Nothing this portal emails is arriving.
            Disconnect, connect again, and say yes to sending when Google asks.
          </p>
        )}
      </Row>

      <Row
        name="Phone & SMS"
        connected={quoConnected}
        failed={quoLine.failed}
        line={quoLine}
        busy={quoSyncing}
        primary={quoConnected ? { label: 'Sync', onClick: () => syncQuo(false) } : null}
        menu={quoConnected ? [
          {
            label: 'Force resync',
            onClick: () => syncQuo(true),
            disabled: quoSyncing,
            title: 'Clears processed message cache and re-syncs all messages with planning note extraction',
          },
          {
            label: 'Find callers nobody has accounted for',
            onClick: sweepCallers,
            disabled: quoSyncing,
            title: 'Every number that has called Rixey and is not a client or a saved contact goes to the review queue with its transcript',
          },
        ] : []}
      />

      <Row
        name="Zoom"
        connected={zoomConnected}
        failed={zoomLine.failed}
        line={zoomLine}
        busy={zoomSyncing}
        primary={zoomConnected
          ? { label: 'Sync', onClick: syncZoom }
          : { label: 'Connect', onClick: connectZoom }}
        menu={zoomConnected ? [
          {
            label: 'Force resync',
            onClick: clearZoom,
            disabled: zoomSyncing,
            title: 'Clear stored transcripts so the next Sync re-downloads everything fresh',
          },
          {
            label: 'Re-extract',
            onClick: reextractZoom,
            disabled: zoomSyncing,
            title: 'Re-run AI extraction on already-synced transcripts',
          },
          { label: 'Re-auth', onClick: connectZoom, title: 'Re-authorise Zoom (use if sync is failing)' },
          { label: 'Disconnect', onClick: disconnectZoom },
        ] : []}
      />

      {historyOpen && (
        <div className="border-t border-cream-100 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-sage-600">Sync history</h4>
            <button onClick={reloadSyncJobs} className="text-xs text-sage-400 hover:text-sage-600">Refresh</button>
          </div>
          {syncJobsLoading ? (
            <p className="text-sage-400 text-xs">Loading…</p>
          ) : syncJobsError ? (
            <p className="text-sage-400 text-xs">
              Could not load. <button onClick={reloadSyncJobs} className="underline hover:text-sage-600">Retry</button>
            </p>
          ) : syncJobs.length === 0 ? (
            <p className="text-sage-400 text-xs">No syncs recorded yet.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto text-xs">
              {syncJobs.map(j => (
                <li key={j.id} className="border-b border-cream-100 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sage-700 capitalize">{j.kind}</span>
                    <span className={`px-1.5 py-0.5 rounded ${
                      j.status === 'failed' ? 'bg-red-100 text-red-700'
                      : j.stalled ? 'bg-amber-100 text-amber-700'
                      : j.status === 'running' ? 'bg-sage-100 text-sage-700'
                      : 'bg-cream-100 text-sage-600'
                    }`}>
                      {j.stalled ? 'stalled' : j.status}
                    </span>
                  </div>
                  <p className="text-sage-400 mt-0.5">
                    {j.trigger || 'manual'} · started {j.started_at ? new Date(j.started_at).toLocaleString() : '—'}
                    {j.finished_at ? ` · finished ${new Date(j.finished_at).toLocaleString()}` : ''}
                  </p>
                  <p className="text-sage-400">
                    {j.processed || 0} processed
                    {j.last_error ? ` · ${j.last_error}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
