import React from 'react';
import { PlayIcon } from './icons.jsx';

const TAG_CLASS = {
  accent: 'tag tag-accent',
  outline: 'tag tag-outline',
  danger: 'tag vc-tag-danger',
  muted: 'tag vc-tag-muted',
};

function RunCard({ run, onOpenRun, busy }) {
  const canOpen = (run.stage === 'done' || run.running) && !busy;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '16/9', background: 'var(--color-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {run.thumbnailUrl ? (
          <img src={run.thumbnailUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <PlayIcon fill="rgba(255,255,255,.7)" width={20} height={20} />
        )}
      </div>
      <div style={{ padding: 16 }}>
        <div className="card-title" style={{ fontSize: 16, marginBottom: 6, overflowWrap: 'anywhere' }}>{run.topic}</div>
        <div className="card-meta" style={{ marginBottom: 10 }}>
          {run.date}{run.source === 'schedule' ? ' · scheduled' : ''}
        </div>

        {run.running && (
          <div className="vc-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.progress} aria-label={`${run.topic} progress`} style={{ marginBottom: 10 }}>
            <div style={{ width: `${Math.min(100, run.progress)}%` }} />
          </div>
        )}

        <span className={TAG_CLASS[run.tone] || 'tag tag-outline'}>
          {run.running ? `${run.status} · ${Math.round(run.progress)}%` : run.status}
        </span>

        {(run.stage === 'error' || run.stage === 'cancelled') && run.error && (
          <div className="vc-run-note">{run.error}</div>
        )}

        {(canOpen || run.postUrl) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {canOpen && (
              <button type="button" className="btn btn-secondary vc-btn-small" onClick={() => onOpenRun(run)}>
                {run.stage === 'done' ? 'Review and post' : 'Watch progress'}
              </button>
            )}
            {run.postUrl && (
              <a className="btn btn-ghost vc-btn-small" href={run.postUrl} target="_blank" rel="noopener noreferrer">View on LinkedIn</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryView({ posts, state = 'ready', onRetry, onOpenRun, busy = false, needsCode = false }) {
  return (
    <div>
      <div className="vc-kicker">History</div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 30, margin: '0 0 8px', color: 'var(--color-text)' }}>
        All runs
      </h1>
      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(32,31,29,.6)', margin: '0 0 28px', maxWidth: 560 }}>
        Everything this backend has generated, from anyone using the site &mdash; including runs still in progress.
      </p>

      {needsCode && (
        <div className="vc-alert vc-alert-error" role="alert">
          <span className="vc-alert-dot" />
          <div>This backend asks for an access code. Enter it in Settings to see the history.</div>
        </div>
      )}

      {!needsCode && state === 'loading' && <div style={{ fontSize: 14.5, color: 'rgba(32,31,29,.6)' }}>Loading history&hellip;</div>}

      {!needsCode && state === 'error' && (
        <div className="vc-alert vc-alert-error" role="alert">
          <span className="vc-alert-dot" />
          <div>
            Couldn&apos;t load history from the backend. Check that the Kaggle notebook is running.{' '}
            <button type="button" className="vc-link" onClick={onRetry}>Try again</button>
          </div>
        </div>
      )}

      {!needsCode && state === 'ready' && posts.length === 0 && (
        <div style={{ fontSize: 14.5, color: 'rgba(32,31,29,.6)' }}>Nothing here yet &mdash; create the first post from New Post.</div>
      )}

      {!needsCode && state === 'ready' && posts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
          {posts.map((run) => <RunCard key={run.id} run={run} onOpenRun={onOpenRun} busy={busy} />)}
        </div>
      )}
    </div>
  );
}
