import React from 'react';
import { CheckIcon } from './icons.jsx';

export default function PostedView({ prompt, postUrl, onCreateAnother }) {
  return (
    <div className="card" style={{ maxWidth: 520, padding: '44px 40px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-accent-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <CheckIcon width={26} height={26} />
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 24, color: 'var(--color-text)', marginBottom: 8 }}>
        Your post is live on LinkedIn
      </div>
      <div style={{ fontSize: '14.5px', color: 'rgba(32,31,29,.6)', marginBottom: 28, overflowWrap: 'anywhere' }}>&ldquo;{prompt}&rdquo; was published just now.</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a
          className="btn btn-secondary"
          href={postUrl || '#'}
          target={postUrl ? '_blank' : undefined}
          rel="noreferrer"
          style={{ pointerEvents: postUrl ? 'auto' : 'none', opacity: postUrl ? 1 : 0.45 }}
        >
          View on LinkedIn
        </a>
        <button className="btn btn-primary" onClick={onCreateAnother}>Create another post</button>
      </div>
    </div>
  );
}
