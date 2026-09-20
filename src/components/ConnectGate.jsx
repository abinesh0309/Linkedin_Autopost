import React, { useState } from 'react';
import {
  getApiBaseUrl, setApiBaseUrl, normalizeApiUrl, getAccessCode, setAccessCode,
  getDefaultApiUrl, hasCustomApiUrl,
} from '../services/api.js';

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '13px 16px', display: 'block', marginBottom: 14,
  border: '1px solid var(--color-neutral-300)', borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-body)', fontSize: '14.5px', color: 'var(--color-text)', background: '#fff',
};

function formatClock(ms) {
  return ms ? new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '';
}

/**
 * Shown instead of the app when the build requires a backend (VITE_REQUIRE_BACKEND)
 * and none is reachable. The page keeps checking by itself, so starting the Kaggle
 * notebook is all it takes for the site to switch over.
 *
 * state: 'checking' | 'offline' | 'needs_code'
 */
export default function ConnectGate({ state, lastCheckAt, onChanged }) {
  const [url, setUrl] = useState(getApiBaseUrl());
  const [code, setCode] = useState(getAccessCode());
  const [formError, setFormError] = useState('');
  const hasUrl = Boolean(getApiBaseUrl());
  const showAddress = state !== 'needs_code' && (!hasUrl || hasCustomApiUrl());

  function submit(event) {
    event.preventDefault();
    setFormError('');
    const result = normalizeApiUrl(url);
    if (!result.ok) { setFormError(result.error); return; }
    if (state !== 'needs_code' || result.url) setApiBaseUrl(result.url);
    setAccessCode(code);
    onChanged();
  }

  function useDefaultAddress() {
    setApiBaseUrl('');
    setUrl(getDefaultApiUrl());
    onChanged();
  }

  const heading = state === 'needs_code' ? 'Enter the access code' : 'Connect the backend to run';
  const lead = state === 'needs_code'
    ? 'The backend is online but asks for an access code before anyone can generate or view posts.'
    : state === 'checking'
      ? 'Looking for the backend…'
      : 'The video and caption generator runs on a Kaggle GPU, and it is not connected right now.';

  return (
    <main className="vc-gate" id="main">
      <div className="vc-gate-card">
        <div className="vc-kicker">{state === 'needs_code' ? 'Access code' : 'Backend offline'}</div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 'clamp(28px, 5vw, 36px)', lineHeight: 1.15, margin: '0 0 12px', color: 'var(--color-text)' }}>
          {heading}
        </h1>
        <p style={{ fontSize: '15.5px', lineHeight: 1.6, color: 'rgba(32,31,29,.65)', margin: '0 0 22px' }}>{lead}</p>

        {state === 'offline' && (
          <ol className="vc-gate-steps">
            <li>Open the Kaggle notebook and run the last cell (the API and tunnel).</li>
            <li>Wait for it to print the Public API URL.</li>
            <li>This page connects on its own &mdash; no refresh needed.</li>
          </ol>
        )}

        <div className="vc-gate-live" role="status">
          <span className="vc-gate-pulse" aria-hidden="true" />
          <span>
            {state === 'needs_code' ? 'Waiting for the code' : 'Checking every few seconds'}
            {lastCheckAt ? ` · last check ${formatClock(lastCheckAt)}` : ''}
          </span>
        </div>

        <form onSubmit={submit} style={{ marginTop: 26 }}>
          {showAddress && (
            <>
              <label htmlFor="gate-url" style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Backend address
              </label>
              <input
                id="gate-url"
                className="vc-textarea"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-name.ngrok-free.app"
                autoComplete="off"
                spellCheck={false}
                style={inputStyle}
              />
            </>
          )}

          <label htmlFor="gate-code" style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Access code {state === 'needs_code' ? '' : '(only if the host gave you one)'}
          </label>
          <input
            id="gate-code"
            className="vc-textarea"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            style={inputStyle}
          />

          {formError && <div role="alert" style={{ marginBottom: 14, fontSize: 13.5, color: '#8a2f1f', lineHeight: 1.5 }}>{formError}</div>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary">{state === 'needs_code' ? 'Unlock' : 'Save and connect'}</button>
            {hasCustomApiUrl() && getDefaultApiUrl() && (
              <button type="button" className="btn btn-ghost" onClick={useDefaultAddress}>Use the site&apos;s default address</button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
