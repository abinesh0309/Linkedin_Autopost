import React from 'react';
import { SparkleIcon, PlusIcon, CalendarIcon, HistoryIcon, SettingsIcon } from './icons.jsx';

const NAV_ITEMS = [
  { key: 'new', label: 'New Post', Icon: PlusIcon },
  { key: 'schedule', label: 'Schedule', Icon: CalendarIcon },
  { key: 'history', label: 'History', Icon: HistoryIcon },
  { key: 'settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Sidebar({ view, onNavigate, backendOnline, mockMode, dueCount = 0, gpuStatus = null, gpuIsMine = false, needsCode = false }) {
  const statusColor = mockMode ? '#bab6b6' : backendOnline ? (needsCode ? '#b68235' : '#3fb96f') : '#c0392b';
  const statusLabel = mockMode
    ? 'Demo mode (no backend set)'
    : backendOnline
      ? (needsCode ? 'Access code needed' : 'Backend connected')
      : 'Backend unreachable';
  const showGpu = !mockMode && backendOnline && !needsCode && gpuStatus;
  const gpuBusy = showGpu && gpuStatus.busy;
  const gpuLabel = gpuBusy
    ? `GPU in use${gpuIsMine ? ' (your run)' : ''} \u00b7 ${Math.round(gpuStatus.progress || 0)}%`
    : 'GPU free';

  return (
    <header className="vc-sidebar">
      <div className="vc-brand">
        <SparkleIcon />
        <span className="vc-brand-name">Venpa Connections</span>
      </div>

      <nav className="vc-nav" aria-label="Main">
        {NAV_ITEMS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`vc-nav-item${view === key ? ' is-active' : ''}`}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => onNavigate(key)}
          >
            <Icon />
            <span>{label}</span>
            {key === 'schedule' && dueCount > 0 && (
              <span className="vc-nav-badge" aria-label={`${dueCount} scheduled ${dueCount === 1 ? 'post' : 'posts'} due`}>{dueCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="vc-status-wrap">
        {showGpu && (
          <div className="vc-gpu" role="status" title={gpuBusy ? `Generating: ${gpuStatus.topic || ''}` : 'The GPU is idle'}>
            <span className={`vc-gpu-dot${gpuBusy ? ' is-busy' : ''}`} aria-hidden="true" />
            <span className="vc-status-label">{gpuLabel}</span>
          </div>
        )}
        <button type="button" className="vc-status" onClick={() => onNavigate('settings')} title="Open Settings">
          <span className="vc-status-dot" style={{ background: statusColor }} />
          <span className="vc-status-label" role="status">{statusLabel}</span>
        </button>
      </div>
    </header>
  );
}
