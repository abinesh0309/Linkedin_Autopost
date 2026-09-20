import React, { useMemo, useState } from 'react';
import { ChevronIcon } from './icons.jsx';
import {
  toDateKey, monthMatrix, makeItem, spreadTopics, compareItems, displayStatus, buildIcs,
} from '../services/schedule.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fieldStyle = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px',
  border: '1px solid var(--color-neutral-300)', borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-body)', fontSize: 14.5, color: 'var(--color-text)', background: '#fff',
};
const labelStyle = { display: 'block', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--color-text)' };

const STATUS_LABEL = {
  posted: 'Posted', overdue: 'Overdue', due: 'Due today', planned: 'Planned',
  generating: 'Generating', ready: 'Ready for review', failed: 'Failed',
};

const MODES = [
  { value: 'off', title: 'Off', text: 'The schedule is a shared calendar only. Nothing happens automatically.' },
  { value: 'generate', title: 'Prepare for review', text: 'At the scheduled time the backend writes the caption and generates the video, then waits for your approval before anything is posted.' },
  { value: 'publish', title: 'Auto-post', text: 'The backend generates and posts to LinkedIn on its own, without asking. Needs the LinkedIn secrets in the notebook.' },
];

const SYNC_TEXT = {
  local: 'Demo mode: this plan is stored in this browser only.',
  syncing: 'Syncing with the backend\u2026',
  synced: 'Synced with the backend, so it is the same on every device.',
  error: 'Backend unreachable. Changes are kept in this browser and will sync when it is back.',
  unsupported: 'This backend has no schedule support yet. Re-run the updated notebook (section 6).',
};

const formatDay = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export default function ScheduleView({
  items, busy, onAdd, onUpdate, onRemove, onGenerate, onReview,
  mode = 'off', onModeChange, syncState = 'local', mockMode = true,
}) {
  const today = toDateKey();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(today);

  const [topic, setTopic] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('10:00');
  const [formError, setFormError] = useState('');

  const [bulkText, setBulkText] = useState('');
  const [bulkStart, setBulkStart] = useState(today);
  const [bulkEvery, setBulkEvery] = useState('2');
  const [bulkError, setBulkError] = useState('');

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const byDate = useMemo(() => {
    const map = {};
    [...items].sort(compareItems).forEach((item) => { (map[item.date] = map[item.date] || []).push(item); });
    return map;
  }, [items]);

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-`;
  const monthItems = useMemo(
    () => items.filter((i) => i.date.startsWith(monthPrefix)).sort(compareItems),
    [items, monthPrefix]
  );
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const plannedCount = items.filter((i) => i.status !== 'posted').length;

  function shiftMonth(delta) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  function pickDay(key) {
    setSelected(key);
    setDate(key);
  }

  function handleAdd(e) {
    e.preventDefault();
    if (!topic.trim()) { setFormError('Enter a topic for the post.'); return; }
    if (!date) { setFormError('Choose a date.'); return; }
    onAdd([makeItem({ topic, date, time })]);
    setTopic('');
    setFormError('');
    setSelected(date);
    setCursor({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 });
  }

  function handleBulk(e) {
    e.preventDefault();
    const topics = bulkText.split('\n').map((t) => t.trim()).filter(Boolean);
    if (topics.length === 0) { setBulkError('Add at least one topic, one per line.'); return; }
    if (!bulkStart) { setBulkError('Choose a start date.'); return; }
    onAdd(spreadTopics(topics, bulkStart, Number(bulkEvery), time));
    setBulkText('');
    setBulkError('');
    setCursor({ year: Number(bulkStart.slice(0, 4)), month: Number(bulkStart.slice(5, 7)) - 1 });
  }

  function exportIcs() {
    const blob = new Blob([buildIcs(items)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'venpa-content-schedule.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <div className="vc-kicker">Schedule</div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 'clamp(26px, 4vw, 32px)', lineHeight: 1.15, margin: '0 0 10px', color: 'var(--color-text)' }}>
        Plan the month
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(32,31,29,.65)', margin: '0 0 24px', maxWidth: 600 }}>
        Line up topics for upcoming days. When a date arrives, generate the post with one click and it
        is marked as posted once it goes live.
      </p>

      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(32,31,29,.65)', margin: '-8px 0 22px' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: syncState === 'synced' ? '#3fb96f' : syncState === 'error' || syncState === 'unsupported' ? '#c0392b' : '#bab6b6' }} />
        {mockMode ? SYNC_TEXT.local : SYNC_TEXT[syncState]}
      </div>

      {!mockMode && syncState !== 'unsupported' && (
        <fieldset className="card vc-automation">
          <legend className="card-title" style={{ fontSize: 19, padding: '0 6px' }}>Automation</legend>
          {MODES.map((m) => (
            <label key={m.value} className={`vc-mode${mode === m.value ? ' is-selected' : ''}`}>
              <input type="radio" name="schedule-mode" value={m.value} checked={mode === m.value} onChange={() => onModeChange(m.value)} />
              <span>
                <span className="vc-mode-title">{m.title}</span>
                <span className="vc-mode-text">{m.text}</span>
              </span>
            </label>
          ))}
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'rgba(32,31,29,.6)' }}>
            Runs only while the Kaggle notebook is running, one post at a time, using your timezone. Items more than
            12 hours overdue are skipped and stay Overdue &mdash; use Generate now for those.
          </div>
        </fieldset>
      )}

      {/* Calendar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="btn btn-secondary vc-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronIcon direction="left" /></button>
          <div className="card-title" style={{ minWidth: 150, textAlign: 'center', fontSize: 20 }} aria-live="polite">{monthLabel}</div>
          <button type="button" className="btn btn-secondary vc-icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronIcon /></button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); pickDay(toDateKey()); }}>Today</button>
          <button type="button" className="btn btn-secondary" onClick={exportIcs} disabled={plannedCount === 0} title="Download reminders for your phone or calendar app">Export .ics</button>
        </div>
      </div>

      <div className="vc-cal">
        <div className="vc-cal-week" role="row">
          {WEEKDAYS.map((d) => <div key={d} className="vc-cal-dow">{d}</div>)}
        </div>
        {weeks.map((week) => (
          <div className="vc-cal-week" key={week[0].key}>
            {week.map((cell) => {
              const dayItems = byDate[cell.key] || [];
              const cls = ['vc-cal-cell', !cell.inMonth && 'is-out', cell.key === today && 'is-today', cell.key === selected && 'is-selected'].filter(Boolean).join(' ');
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={cls}
                  onClick={() => pickDay(cell.key)}
                  aria-label={`${formatDay(cell.key)}, ${dayItems.length} ${dayItems.length === 1 ? 'post' : 'posts'}`}
                  aria-pressed={cell.key === selected}
                >
                  <span className="vc-cal-day">{cell.day}</span>
                  {dayItems.slice(0, 2).map((item) => (
                    <span key={item.id} className={`vc-cal-chip is-${displayStatus(item, today)}`}>{item.topic}</span>
                  ))}
                  {dayItems.length > 2 && <span className="vc-cal-more">+{dayItems.length - 2} more</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Forms */}
      <div className="vc-two-col" style={{ marginTop: 28 }}>
        <form className="card" onSubmit={handleAdd} noValidate style={{ padding: 20 }}>
          <div className="card-title" style={{ fontSize: 19 }}>Add a post</div>
          <div>
            <label htmlFor="sched-topic" style={labelStyle}>Topic</label>
            <input id="sched-topic" className="vc-textarea" style={fieldStyle} value={topic} maxLength={400} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Diwali greetings for clients" />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="sched-date" style={labelStyle}>Date</label>
              <input id="sched-date" className="vc-textarea" type="date" style={fieldStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="sched-time" style={labelStyle}>Time</label>
              <input id="sched-time" className="vc-textarea" type="time" style={fieldStyle} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {formError && <div role="alert" style={{ fontSize: 13, color: '#8a2f1f' }}>{formError}</div>}
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Add to schedule</button>
        </form>

        <form className="card" onSubmit={handleBulk} noValidate style={{ padding: 20 }}>
          <div className="card-title" style={{ fontSize: 19 }}>Plan several at once</div>
          <div>
            <label htmlFor="bulk-topics" style={labelStyle}>Topics, one per line</label>
            <textarea id="bulk-topics" className="vc-textarea" style={{ ...fieldStyle, minHeight: 84, resize: 'vertical' }} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'Diwali greetings\nWeekly founder tip\nNew office opening'} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="bulk-start" style={labelStyle}>Starting</label>
              <input id="bulk-start" className="vc-textarea" type="date" style={fieldStyle} value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="bulk-every" style={labelStyle}>Every</label>
              <select id="bulk-every" className="vc-textarea" style={fieldStyle} value={bulkEvery} onChange={(e) => setBulkEvery(e.target.value)}>
                <option value="1">day</option>
                <option value="2">2 days</option>
                <option value="3">3 days</option>
                <option value="7">week</option>
              </select>
            </div>
          </div>
          {bulkError && <div role="alert" style={{ fontSize: 13, color: '#8a2f1f' }}>{bulkError}</div>}
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Spread across dates</button>
        </form>
      </div>

      {/* Month list */}
      <div className="hr" />
      <div className="card-title" style={{ fontSize: 20, marginBottom: 14 }}>Scheduled in {monthLabel}</div>
      {monthItems.length === 0 ? (
        <div style={{ fontSize: 14.5, color: 'rgba(32,31,29,.6)' }}>Nothing planned for this month yet.</div>
      ) : (
        <div>
          {monthItems.map((item) => {
            const status = displayStatus(item, today);
            return (
              <div key={item.id} className="vc-sched-row">
                <div className="vc-sched-when">
                  <div style={{ fontWeight: 600 }}>{formatDay(item.date)}</div>
                  <div style={{ fontSize: 12, color: 'rgba(32,31,29,.55)' }}>{item.time}</div>
                </div>
                <div className="vc-sched-topic">
                  {item.topic}
                  {item.error && <div className="vc-sched-error">{item.error}</div>}
                </div>
                <span className={`tag ${status === 'overdue' || status === 'failed' ? 'vc-tag-danger' : status === 'posted' ? 'vc-tag-muted' : 'tag-accent'}`}>{STATUS_LABEL[status]}</span>
                <div className="vc-sched-actions">
                  {(status === 'planned' || status === 'due' || status === 'overdue') && (
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onGenerate(item)} title={busy ? 'A post is already being generated' : undefined}>Generate now</button>
                  )}
                  {(status === 'ready' || status === 'generating') && (
                    <button type="button" className="btn btn-primary" disabled={busy || !item.job_id} onClick={() => onReview(item)}>
                      {status === 'ready' ? 'Review' : 'Watch progress'}
                    </button>
                  )}
                  {status === 'failed' && (
                    <button type="button" className="btn btn-primary" onClick={() => onUpdate(item.id, { status: 'planned' })}>Retry</button>
                  )}
                  {status !== 'posted' && status !== 'generating' && (
                    <button type="button" className="btn btn-ghost" onClick={() => onUpdate(item.id, { status: 'posted' })}>Mark done</button>
                  )}
                  <button type="button" className="btn btn-ghost" disabled={status === 'generating'} onClick={() => onRemove(item.id)} aria-label={`Remove ${item.topic}`}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
