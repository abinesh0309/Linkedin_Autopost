import React, { useState } from 'react';
import {
  getApiBaseUrl, setApiBaseUrl, normalizeApiUrl, checkHealth, getAccessCode, setAccessCode, verifyAccessCode, isBackendRequired,
} from '../services/api.js';

const inputStyle = {
  width: '100%', maxWidth: 480, boxSizing: 'border-box', padding: '13px 16px',
  border: '1px solid var(--color-neutral-300)', borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-body)', fontSize: '14.5px', color: 'var(--color-text)',
  background: '#fff', marginBottom: 16, display: 'block',
};

export default function SettingsView({ onChanged, onSaved }) {
  const requireBackend = isBackendRequired();
  const [url, setUrl] = useState(getApiBaseUrl());
  const [code, setCode] = useState(getAccessCode());
  const [status, setStatus] = useState(null); // null | 'checking' | 'ok' | 'fail'
  const [statusDetail, setStatusDetail] = useState('');

  // Validates + stores the URL; returns the clean URL or null on invalid input.
  function commit() {
    const result = normalizeApiUrl(url);
    if (!result.ok) {
      setStatus('fail');
      setStatusDetail(result.error);
      return null;
    }
    setApiBaseUrl(result.url);
    setAccessCode(code);
    setUrl(result.url);
    return result.url;
  }

  async function handleTest() {
    setStatus('checking');
    setStatusDetail('');
    const clean = commit();
    if (clean === null) return;
    if (onChanged) onChanged();
    const result = await checkHealth();
    if (result.ok) {
      const gpuLine = result.data?.gpu ? `Connected \u2014 ${result.data.gpu}` : 'Connected to the backend.';
      if (result.data?.auth_required) {
        try {
          await verifyAccessCode();
          setStatus('ok');
          setStatusDetail(`${gpuLine} Access code accepted.`);
        } catch {
          setStatus('fail');
          setStatusDetail('The backend is reachable, but the access code is missing or wrong.');
        }
      } else {
        setStatus('ok');
        setStatusDetail(gpuLine);
      }
    } else if (result.reason === 'no_url') {
      setStatus('fail');
      setStatusDetail(requireBackend ? 'Paste the Public API URL first.' : 'Paste the Public API URL first, or leave it empty to stay in demo mode.');
    } else {
      setStatus('fail');
      setStatusDetail("Can't reach that URL. Make sure the Kaggle tab is open, the API cell (section 6) is still running, and you copied the URL exactly as it was printed.");
    }
  }

  function handleSave() {
    if (commit() === null) return;
    if (onSaved) onSaved();
  }

  function handleClear() {
    setApiBaseUrl('');
    setAccessCode('');
    setCode('');
    setUrl(requireBackend ? getApiBaseUrl() : '');
    setStatus(null);
    if (onChanged) onChanged();
  }

  const hasUrl = Boolean(url.trim());

  return (
    <div>
      <div className="vc-kicker">Settings</div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 32, lineHeight: 1.15, margin: '0 0 10px', color: 'var(--color-text)' }}>
        Backend connection
      </h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', lineHeight: 1.6, color: 'rgba(32,31,29,.65)', margin: '0 0 26px', maxWidth: 580 }}>
        Paste the <strong>Public API URL</strong> printed by the server. 
      </p>

      <label htmlFor="api-url" style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
        Public API URL
      </label>
      <input
        id="api-url"
        className="vc-textarea"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://xxxx-xx-xx-xx-xx.ngrok-free.app"
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
      />

      <label htmlFor="access-code" style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
        Access code <span style={{ fontWeight: 400, color: 'rgba(32,31,29,.55)' }}>(only if the backend has one set)</span>
      </label>
      <input
        id="access-code"
        className="vc-textarea"
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="off"
        style={inputStyle}
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleSave}>Save</button>
        <button className="btn btn-secondary" onClick={handleTest}>Test connection</button>
        {hasUrl && <button className="btn btn-ghost" onClick={handleClear}>{requireBackend ? 'Reset' : 'Clear (demo mode)'}</button>}
      </div>

      {status && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, maxWidth: 520, lineHeight: 1.5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', marginTop: 5, flex: 'none',
            background: status === 'ok' ? '#3fb96f' : status === 'fail' ? '#c0392b' : '#bab6b6',
          }} />
          <span style={{ color: status === 'fail' ? '#8a2f1f' : 'var(--color-text)' }}>
            {status === 'checking' ? 'Checking…' : statusDetail}
          </span>
        </div>
      )}

    </div>
  );
}
