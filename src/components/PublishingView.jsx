import React from 'react';

export default function PublishingView() {
  return (
    <div className="card" style={{ maxWidth: 480, padding: '44px 40px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--color-neutral-200)', borderTopColor: 'var(--color-accent)', margin: '0 auto 20px', animation: 'vc-spin 0.9s linear infinite' }} />
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 19, color: 'var(--color-text)', marginBottom: 6 }}>
        Publishing to LinkedIn
      </div>
      <div style={{ fontSize: 14, color: 'rgba(32,31,29,.6)' }}>Sending your video and caption live&hellip;</div>
    </div>
  );
}
