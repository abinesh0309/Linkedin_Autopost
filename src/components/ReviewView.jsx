import React, { useEffect, useState } from 'react';
import { PlayIcon, LikeIcon, CommentIcon, ShareIcon, LinkedInBadge } from './icons.jsx';
import { fetchMediaObjectUrl } from '../services/api.js';

export default function ReviewView({ caption, hashtags, videoUrl, onAccept, onRegenerate, publishError }) {
  const [playableUrl, setPlayableUrl] = useState(null);
  const [videoError, setVideoError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setPlayableUrl(null);
    setVideoError('');

    if (!videoUrl) return undefined;

    fetchMediaObjectUrl(videoUrl)
      .then((url) => {
        if (cancelled) {
          if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPlayableUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setVideoError(err.message || 'Could not load the video.');
      });

    return () => {
      cancelled = true;
      if (objectUrl && objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
    };
  }, [videoUrl]);

  return (
    <div>
      <div className="vc-kicker">Ready to review</div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 'clamp(26px, 4vw, 30px)', margin: '0 0 24px', color: 'var(--color-text)' }}>
        Your post is ready
      </h1>

      <div className="vc-review-grid">
        {/* LinkedIn preview */}
        <div style={{ border: '1px solid var(--color-neutral-300)', borderRadius: 'var(--radius-md)', background: '#fff', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-sidebar)', color: '#b68235', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, flex: 'none' }}>V</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>Venpa Connections</div>
              <div style={{ fontSize: 12, color: 'rgba(32,31,29,.55)' }}>Just now &middot; Public</div>
            </div>
            <LinkedInBadge />
          </div>
          <div style={{ padding: '0 16px 14px', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{caption}</div>
          <div style={{ aspectRatio: '16/9', background: 'var(--color-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {videoUrl && playableUrl && (
              <video src={playableUrl} controls playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {videoUrl && !playableUrl && !videoError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,.25)', borderTopColor: 'rgba(255,255,255,.85)', animation: 'vc-spin 0.9s linear infinite' }} />
                Loading video&hellip;
              </div>
            )}
            {videoUrl && videoError && (
              <div style={{ padding: '0 20px', textAlign: 'center', color: '#f3b0a3', fontSize: 12.5, lineHeight: 1.5 }}>{videoError}</div>
            )}
            {!videoUrl && (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlayIcon />
                </div>
                <span style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 11, color: 'rgba(255,255,255,.7)', fontFamily: 'var(--font-body)' }}>Demo preview &middot; no video generated</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 20, padding: '12px 16px', color: 'rgba(32,31,29,.5)', fontSize: '12.5px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LikeIcon />Like</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CommentIcon />Comment</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ShareIcon />Share</span>
          </div>
        </div>

        {/* Actions panel */}
        <div>
          <label htmlFor="review-caption" style={{ display: 'block', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13, color: 'var(--color-text)', marginBottom: 8 }}>Caption</label>
          <textarea
            id="review-caption"
            value={caption}
            readOnly
            style={{
              width: '100%', minHeight: 120, boxSizing: 'border-box', padding: '14px 16px',
              border: '1px solid var(--color-neutral-300)', borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text)',
              background: '#fff', resize: 'vertical', marginBottom: 16,
            }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            {hashtags.map((tag) => (
              <span key={tag} className="tag tag-accent">{tag}</span>
            ))}
          </div>

          {publishError && (
            <div role="alert" style={{ marginBottom: 16, fontSize: 13.5, color: '#8a2f1f', lineHeight: 1.5 }}>{publishError}</div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onAccept} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LinkedInBadge size={16} fontSize={9} />
              Accept &amp; post to LinkedIn
            </button>
            <button className="btn btn-ghost" onClick={onRegenerate}>Regenerate</button>
            {playableUrl && playableUrl.startsWith('blob:') && (
              <a className="btn btn-ghost" href={playableUrl} download="venpa-post.mp4">Download video</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
