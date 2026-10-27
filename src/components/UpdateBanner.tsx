import { dismissUpdate, installUpdate, useUpdate } from '../lib/updater'

export function UpdateBanner() {
  const u = useUpdate()
  if (u.phase === 'idle') return null
  const { release } = u

  return (
    <div className="update-banner" role="status">
      <div className="grow">
        <strong>Update {release.versionName}</strong>
        <div className="small muted">
          {u.phase === 'downloading'
            ? `Downloading… ${Math.round(u.progress * 100)}%`
            : u.phase === 'error'
              ? `Couldn't download: ${u.message}`
              : (release.notes ?? 'A new version is ready.')}
        </div>
        {u.phase === 'downloading' && (
          <div className="meter update-meter">
            <span style={{ width: `${Math.round(u.progress * 100)}%` }} />
          </div>
        )}
      </div>
      {u.phase !== 'downloading' && (
        <div className="update-actions">
          <button className="btn primary" onClick={installUpdate}>
            {u.phase === 'error' ? 'Retry' : 'Install'}
          </button>
          <button className="icon-btn" onClick={dismissUpdate} aria-label="Not now">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
