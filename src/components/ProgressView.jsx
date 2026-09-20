import React from 'react';
import { CheckIcon, ClockNoteIcon } from './icons.jsx';

// The backend reports one of these coarse stages for a job (see the notebook's
// run_pipeline). Each stage maps onto the 4 steps the design shows.
const STEPS = [
  { key: 'understand', label: 'Understanding your prompt', stage: 'planning' },
  { key: 'write', label: 'Writing caption & content', stage: 'planning' },
  { key: 'video', label: 'Generating video with Hugging Face model', stage: 'generating_video', note: 'High-quality video generation takes a few minutes. Hang tight.' },
  { key: 'review', label: 'Finalizing video for review', stage: 'finalizing' },
];

const STAGE_ORDER = ['planning', 'generating_video', 'finalizing', 'done'];

function stepStatus(step, currentStage) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const stepIdx = STAGE_ORDER.indexOf(step.stage);
  if (currentIdx > stepIdx) return 'done';
  if (currentIdx === stepIdx) return 'active';
  return 'pending';
}

export default function ProgressView({ prompt, stage, overallPercent, stalled = false }) {
  return (
    <div className="card" style={{ maxWidth: 640, padding: 'clamp(22px, 5vw, 36px) clamp(20px, 5vw, 40px)' }}>
      <div className="card-kicker" style={{ color: 'var(--color-accent-700)' }}>Generating</div>
      <div className="card-title" style={{ fontSize: 24, marginBottom: 6 }}>Creating your post</div>
      <div style={{ fontSize: '14.5px', color: 'rgba(32,31,29,.6)', marginBottom: 26, overflowWrap: 'anywhere' }}>&ldquo;{prompt}&rdquo;</div>

      {stalled && (
        <div className="vc-alert vc-alert-error" role="alert" style={{ marginBottom: 22 }}>
          <span className="vc-alert-dot" />
          <div>
            The backend hasn&apos;t reported progress for a while. The Kaggle kernel may have stopped &mdash; check the notebook tab.
            If it did, start this post again once the API cell is running.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'rgba(32,31,29,.55)', marginBottom: 8 }}>
        <span id="progress-label">Overall progress</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{overallPercent}%</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby="progress-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={overallPercent}
        style={{ height: 6, borderRadius: 3, background: 'var(--color-neutral-200)', overflow: 'hidden', marginBottom: 30 }}
      >
        <div style={{ height: '100%', background: 'var(--color-accent)', borderRadius: 3, width: `${overallPercent}%`, transition: 'width .3s ease' }} />
      </div>

      {STEPS.map((step, i) => {
        const status = stepStatus(step, stage);
        const isDone = status === 'done';
        const isActive = status === 'active';
        const isPending = status === 'pending';
        return (
          <div key={step.key} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '16px 0', borderBottom: '1px solid var(--color-divider)' }}>
            {isDone && (
              <div style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: 'var(--color-accent-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckIcon />
              </div>
            )}
            {isActive && (
              <div style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', border: '2.5px solid var(--color-neutral-200)', borderTopColor: 'var(--color-accent)', animation: 'vc-spin 0.9s linear infinite' }} />
            )}
            {isPending && (
              <div style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--color-neutral-300)', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontFamily: 'var(--font-heading)' }}>
                {i + 1}
              </div>
            )}
            <div style={{ flex: 1, paddingTop: 2 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: isPending ? 'var(--color-neutral-400)' : 'var(--color-text)' }}>
                {step.label}
              </div>
              {isActive && step.note && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13, color: 'var(--color-accent-700)' }}>
                  <ClockNoteIcon />
                  {step.note}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
