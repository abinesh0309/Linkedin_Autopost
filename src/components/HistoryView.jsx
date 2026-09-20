import React from 'react';
import { PlayIcon } from './icons.jsx';

export default function HistoryView({ posts, state = 'ready', onRetry }) {
  return (
    <div>
      <div className="vc-kicker">Post history</div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 30, margin: '0 0 28px', color: 'var(--color-text)' }}>
        Past posts
      </h1>

      {state === 'loading' && <div style={{ fontSize: 14.5, color: 'rgba(32,31,29,.6)' }}>Loading your posts&hellip;</div>}

      {state === 'error' && (
        <div className="vc-alert vc-alert-error" role="alert">
          <span className="vc-alert-dot" />
          <div>
            Couldn&apos;t load history from the backend. Check that the Kaggle notebook is running.{' '}
            <button type="button" className="vc-link" onClick={onRetry}>Try again</button>
          </div>
        </div>
      )}

      {state === 'ready' && posts.length === 0 && (
        <div style={{ fontSize: 14.5, color: 'rgba(32,31,29,.6)' }}>No posts yet &mdash; create your first one from New Post.</div>
      )}

      {state === 'ready' && posts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
          {posts.map((post) => (
            <div key={post.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ aspectRatio: '16/9', background: 'var(--color-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {post.thumbnailUrl ? (
                  <img src={post.thumbnailUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <PlayIcon fill="rgba(255,255,255,.7)" width={20} height={20} />
                )}
              </div>
              <div style={{ padding: 16 }}>
                <div className="card-title" style={{ fontSize: 16, marginBottom: 6, overflowWrap: 'anywhere' }}>{post.topic}</div>
                <div className="card-meta" style={{ marginBottom: 10 }}>{post.date}</div>
                <span className="tag tag-accent">{post.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
