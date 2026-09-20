// Content schedule: a plan of topics for upcoming days.
//
// It is always saved in the browser. While a backend is connected it is also
// synced with the backend (see App.jsx), whose optional worker can generate -
// and, if allowed, post - each item when it is due. Each entry can also be
// turned into a real post by hand ("Generate now"), and is marked as posted
// once it is published.

const STORAGE_KEY = 'vc_schedule_v1';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- Date helpers (all local time, keys are YYYY-MM-DD) ----------------------

const pad = (n) => String(n).padStart(2, '0');

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, days) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Monday-first month grid. Returns an array of weeks, each 7 cells. */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((offset + daysInMonth) / 7);
  const weeks = [];
  for (let w = 0; w < weekCount; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(year, month, 1 - offset + w * 7 + d);
      week.push({ key: toDateKey(date), day: date.getDate(), inMonth: date.getMonth() === month });
    }
    weeks.push(week);
  }
  return weeks;
}

// ---- Storage ----------------------------------------------------------------

function isValidItem(item) {
  return item && typeof item.id === 'string' && typeof item.topic === 'string' && DATE_RE.test(item.date || '');
}

export function loadSchedule() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isValidItem) : [];
  } catch {
    return [];
  }
}

export function saveSchedule(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable - the schedule just won't persist.
  }
}

// ---- Items ------------------------------------------------------------------

export function makeItem({ topic, date, time = '10:00' }) {
  return {
    id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    topic: topic.trim(),
    date,
    time,
    status: 'planned',
  };
}

export function compareItems(a, b) {
  return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || a.topic.localeCompare(b.topic);
}

/** 'posted' | 'generating' | 'ready' | 'failed' | 'overdue' | 'due' | 'planned' */
export function displayStatus(item, todayKey) {
  if (['posted', 'generating', 'ready', 'failed'].includes(item.status)) return item.status;
  if (item.date < todayKey) return 'overdue';
  if (item.date === todayKey) return 'due';
  return 'planned';
}

/** Spreads a list of topics across dates, one every `everyDays` days. */
export function spreadTopics(topics, startKey, everyDays, time) {
  return topics
    .map((t) => t.trim())
    .filter(Boolean)
    .map((topic, i) => makeItem({ topic, date: addDays(startKey, i * everyDays), time }));
}

// ---- Calendar export (.ics) -------------------------------------------------

function icsEscape(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsStamp(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

/** Builds an iCalendar file with a 15-minute reminder for each planned post. */
export function buildIcs(items) {
  const now = new Date();
  const utcStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Venpa Connections//Content Schedule//EN', 'CALSCALE:GREGORIAN'];

  items
    .filter((item) => item.status !== 'posted')
    .sort(compareItems)
    .forEach((item) => {
      const [hh, mm] = (item.time || '10:00').split(':').map(Number);
      const start = parseDateKey(item.date);
      start.setHours(hh || 0, mm || 0, 0, 0);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${item.id}@venpa-connections`,
        `DTSTAMP:${utcStamp}`,
        `DTSTART:${icsStamp(start)}`,
        `DTEND:${icsStamp(end)}`,
        `SUMMARY:${icsEscape(`Post: ${item.topic}`)}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(`Time to generate and post: ${item.topic}`)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
