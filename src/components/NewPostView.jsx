import React from 'react';
import { GenerateSparkleIcon } from './icons.jsx';

const EXAMPLES = [
  { label: 'Krishna Jayanthi', topic: 'Generate content for Krishna Jayanthi' },
  { label: 'New office opening', topic: 'Announce our new office opening in Chennai' },
  { label: 'Weekly founder tip', topic: 'Share a weekly productivity tip for founders' },
];

const formatDay = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function NewPostView({
  prompt, setPrompt, onGenerate, error, backendOnline, mockMode, onOpenSettings, gpuStatus = null, needsCode = false,
  dueItems = [], readyItems = [], linkedItem = null, onUseScheduled, onReviewScheduled, onOpenSchedule,
}) {
  const gpuBusy = Boolean(gpuStatus && gpuStatus.busy);
  const disabled = !prompt.trim() || gpuBusy || needsCode;

  return (
    <div>
      <div className="vc-kicker">New post</div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 'clamp(28px, 4.5vw, 36px)', lineHeight: 1.15, margin: '0 0 10px', color: 'var(--color-text)' }}>
        What should we create today?
      </h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '15.5px', lineHeight: 1.6, color: 'rgba(32,31,29,.65)', margin: '0 0 20px', maxWidth: 560 }}>
        Describe the occasion or topic. Venpa Connections will write the caption, generate a video, and post it to LinkedIn for you.
      </p>

      {!mockMode && !backendOnline && (
        <div className="vc-alert vc-alert-error" role="alert">
          <span className="vc-alert-dot" />
          <div>
            Can&apos;t reach the Kaggle backend right now.{' '}
            <button type="button" className="vc-link" onClick={onOpenSettings}>Check the connection in Settings</button>{' '}
            before generating &mdash; otherwise the request will fail partway through.
          </div>
        </div>
      )}

      {!mockMode && backendOnline && needsCode && (
        <div className="vc-alert vc-alert-error" role="alert">
          <span className="vc-alert-dot" />
          <div>
            This backend asks for an access code.{' '}
            <button type="button" className="vc-link" onClick={onOpenSettings}>Enter it in Settings</button>.
          </div>
        </div>
      )}

      {gpuBusy && (
        <div className="vc-alert vc-alert-accent" role="status">
          <span className="vc-alert-dot" />
          <div>
            <strong style={{ fontWeight: 600 }}>The GPU is in use.</strong>{' '}
            {gpuStatus.source === 'schedule' ? 'A scheduled post is being generated' : 'Someone else is generating'}
            {gpuStatus.topic ? <> &ldquo;{gpuStatus.topic}&rdquo;</> : null}
            {' '}&mdash; {Math.round(gpuStatus.progress || 0)}% done. You can start yours as soon as it finishes;
            this page updates by itself.
            <div className="vc-meter" aria-hidden="true"><div style={{ width: `${Math.min(100, Math.round(gpuStatus.progress || 0))}%` }} /></div>
          </div>
        </div>
      )}

      {readyItems.length > 0 && !linkedItem && (
        <div className="vc-alert vc-alert-accent">
          <span className="vc-alert-dot" />
          <div>
            <strong style={{ fontWeight: 600 }}>
              {readyItems.length} scheduled {readyItems.length === 1 ? 'post is' : 'posts are'} ready for your review.
            </strong>
            <div className="vc-due-list">
              {readyItems.slice(0, 3).map((item) => (
                <button key={item.id} type="button" className="vc-chip" onClick={() => onReviewScheduled(item)} title="Review this post">
                  <span className="tag tag-outline" style={{ cursor: 'pointer' }}>Review &middot; {item.topic}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {dueItems.length > 0 && !linkedItem && (
        <div className="vc-alert vc-alert-accent">
          <span className="vc-alert-dot" />
          <div>
            <strong style={{ fontWeight: 600 }}>
              {dueItems.length} scheduled {dueItems.length === 1 ? 'post is' : 'posts are'} due.
            </strong>{' '}
            <button type="button" className="vc-link" onClick={onOpenSchedule}>Open the schedule</button>
            <div className="vc-due-list">
              {dueItems.slice(0, 3).map((item) => (
                <button key={item.id} type="button" className="vc-chip" onClick={() => onUseScheduled(item)} title="Use this topic">
                  <span className="tag tag-outline" style={{ cursor: 'pointer' }}>{formatDay(item.date)} &middot; {item.topic}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {linkedItem && (
        <div className="vc-alert vc-alert-accent">
          <span className="vc-alert-dot" />
          <div>
            From your schedule for {formatDay(linkedItem.date)}. It will be marked as posted once it goes live.
          </div>
        </div>
      )}

      <label htmlFor="post-topic" className="vc-visually-hidden">Post topic</label>
      <textarea
        id="post-topic"
        className="vc-textarea"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Generate content for Krishna Jayanthi"
        maxLength={400}
        style={{
          width: '100%', minHeight: 110, boxSizing: 'border-box', padding: '16px 18px',
          border: '1px solid var(--color-neutral-300)', borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-body)', fontSize: '15.5px', lineHeight: 1.5,
          color: 'var(--color-text)', background: '#fff', resize: 'vertical',
        }}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0 28px' }}>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" className="vc-chip" onClick={() => setPrompt(ex.topic)}>
            <span className="tag tag-outline" style={{ cursor: 'pointer' }}>{ex.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: 20, fontSize: 13.5, color: '#8a2f1f', maxWidth: 560, lineHeight: 1.5 }}>{error}</div>
      )}

      <button className="btn btn-primary" disabled={disabled} onClick={onGenerate} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <GenerateSparkleIcon />
        {gpuBusy ? 'Waiting for the GPU' : 'Generate post'}
      </button>
    </div>
  );
}
