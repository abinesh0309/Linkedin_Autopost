// Small inline icon set, ported 1:1 from the paths used in the Claude Design
// mockup (Venpa Connections.dc.html) so the UI matches pixel-for-pixel.
import React from 'react';

export const SparkleIcon = (props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b68235" strokeWidth="1.8" {...props}>
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
  </svg>
);

export const PlusIcon = (props) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CalendarIcon = (props) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const ChevronIcon = ({ direction = 'right', ...props }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

export const HistoryIcon = (props) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export const SettingsIcon = (props) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 003.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8c.27.63.86 1.06 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

export const GenerateSparkleIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
  </svg>
);

export const CheckIcon = ({ color = '#fff', ...props }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" {...props}>
    <path d="M4 12l5 5L20 6" />
  </svg>
);

export const ClockNoteIcon = (props) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export const PlayIcon = ({ fill = '#fff', ...props }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={fill} {...props}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const LikeIcon = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76" />
  </svg>
);

export const CommentIcon = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const ShareIcon = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 0 6h.17A3 3 0 0 0 18 8zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 6a3 3 0 1 0-2.83-4H15a3 3 0 0 0 0 6h.17A3 3 0 0 0 18 21z" />
    <path d="M8.6 13.5l6.8 3.9M15.4 6.6 8.6 10.5" />
  </svg>
);

export const LinkedInBadge = ({ size = 20, fontSize = 11 }) => (
  <div
    style={{
      width: size, height: size, borderRadius: 3, background: 'var(--color-linkedin)',
      color: '#fff', fontSize, fontWeight: 700, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flex: 'none',
    }}
  >
    in
  </div>
);
