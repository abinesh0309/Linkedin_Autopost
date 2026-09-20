// API client for the Kaggle-hosted backend (FastAPI behind an ngrok tunnel).
//
// Backend contract:
//   GET  /health                 -> { status, gpu, gpu_status: { busy, topic?, progress?, ... }, auth_required, time }
//   GET  /auth                   -> { ok }            (verifies the access code)
//   POST /jobs { topic }         -> { job_id, owner_token }   (409 while the GPU is in use)
//   GET  /jobs                   -> [ every run: { id, stage, progress, topic, caption?, video_url?, post_url?, error?, created_at } ]
//   GET  /jobs/{id}              -> { stage, progress, caption?, hashtags?, video_url?, error?, stalled? }
//   POST /jobs/{id}/heartbeat    { owner_token }   keeps a run alive while its page is open
//   POST /jobs/{id}/leave        { owner_token }   the page is closing: stop soon unless it comes back
//   POST /jobs/{id}/cancel       { owner_token }   stop the run and free the GPU
//   POST /jobs/{id}/publish      -> { stage: 'publishing' }
//   GET  /posts                  -> [{ id, topic, date, status }]
//
// With no backend URL configured the app runs in demo mode: every call below
// is simulated locally, so a freshly deployed site is always clickable - unless
// the build sets VITE_REQUIRE_BACKEND=true, which removes demo mode entirely.

const API_BASE_URL_KEY = 'vc_api_base_url';
const ACCESS_CODE_KEY = 'vc_access_code';

const DEFAULT_TIMEOUT_MS = 30000;
const HEALTH_TIMEOUT_MS = 8000;
const JOB_POLL_INTERVAL_MS = 1500;
const MAX_POLL_FAILURES = 6;
const MAX_POLL_BACKOFF_MS = 8000;

export class ApiError extends Error {
  constructor(message, { status = 0, network = false, gpuStatus = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.network = network;
    this.gpuStatus = gpuStatus;
  }
}

// ---- Backend URL handling ---------------------------------------------------

/**
 * Cleans up whatever the user pasted into Settings. Returns
 * { ok: true, url } (url may be '' meaning "clear it") or { ok: false, error }.
 */
export function normalizeApiUrl(input) {
  const raw = (input || '').trim();
  if (!raw) return { ok: true, url: '' };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL. Paste the Public API URL exactly as the notebook printed it." };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'The URL must start with https:// (or http:// for a local backend).' };
  }

  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  const pageIsHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  if (parsed.protocol === 'http:' && !isLocal && pageIsHttps) {
    return {
      ok: false,
      error: 'This site is served over https, so the browser blocks plain http:// backends. Use the https:// URL that ngrok printed.',
    };
  }

  return { ok: true, url: `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '') };
}

/** The address baked into this build (VITE_API_BASE_URL), if any. */
export function getDefaultApiUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
}

/** True when the URL saved in this browser differs from the build's default. */
export function hasCustomApiUrl() {
  try {
    const stored = (localStorage.getItem(API_BASE_URL_KEY) || '').replace(/\/+$/, '');
    return Boolean(stored) && stored !== getDefaultApiUrl();
  } catch {
    return false;
  }
}

export function getAccessCode() {
  try {
    return localStorage.getItem(ACCESS_CODE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAccessCode(code) {
  const clean = (code || '').trim();
  try {
    if (clean) localStorage.setItem(ACCESS_CODE_KEY, clean);
    else localStorage.removeItem(ACCESS_CODE_KEY);
  } catch {
    // Best-effort only.
  }
  return clean;
}

function accessHeaders() {
  const code = getAccessCode();
  return code ? { 'X-Access-Code': code } : {};
}

export function getApiBaseUrl() {
  try {
    const stored = localStorage.getItem(API_BASE_URL_KEY);
    if (stored) return stored.replace(/\/+$/, '');
  } catch {
    // localStorage unavailable (private mode, blocked storage) - use the build-time default.
  }
  return getDefaultApiUrl();
}

export function setApiBaseUrl(url) {
  const clean = (url || '').trim().replace(/\/+$/, '');
  try {
    if (clean) localStorage.setItem(API_BASE_URL_KEY, clean);
    else localStorage.removeItem(API_BASE_URL_KEY);
  } catch {
    // Best-effort only.
  }
  return clean;
}

/**
 * Lets a link like https://your-app.vercel.app/?api=https://xxxx.ngrok-free.app
 * connect a browser to the backend in one click (handy on a phone, or for
 * sending a reviewer a working link). The parameter is stripped from the
 * address bar after it is saved. Returns true when a URL was applied.
 */
export function applyApiUrlFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('api')) return false;
    const result = normalizeApiUrl(params.get('api'));
    if (result.ok && result.url) setApiBaseUrl(result.url);
    params.delete('api');
    const query = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
    return Boolean(result.ok && result.url);
  } catch {
    return false;
  }
}

function forcedMockMode() {
  return (import.meta.env.VITE_MOCK_MODE ?? '') === 'true';
}

/**
 * VITE_REQUIRE_BACKEND=true removes demo mode: the site shows "connect the
 * backend" until the Kaggle API answers, and never simulates anything.
 */
export function isBackendRequired() {
  return (import.meta.env.VITE_REQUIRE_BACKEND ?? '') === 'true';
}

// Read this fresh instead of caching it, so switching between demo and live
// mode from Settings takes effect on the very next action.
export function isMockModeActive() {
  if (isBackendRequired()) return false;
  if (forcedMockMode()) return true;
  return !getApiBaseUrl();
}

// ---- HTTP helper ------------------------------------------------------------

async function request(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError('No backend URL configured yet. Open Settings and paste the Public API URL printed by the Kaggle notebook.');
  }

  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        // Skips ngrok's free-tier browser-warning interstitial, which has no
        // CORS headers and otherwise surfaces as an opaque "Failed to fetch".
        'ngrok-skip-browser-warning': 'true',
        ...accessHeaders(),
        ...(headers || {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    // fetch() only throws for network/CORS/abort failures, never for HTTP
    // error statuses - so this always means "couldn't get a response".
    if (err && err.name === 'AbortError') {
      throw new ApiError(`The backend at ${baseUrl} took too long to respond. The Kaggle notebook may be busy or stopped.`, { network: true });
    }
    throw new ApiError(
      `Can't reach the backend at ${baseUrl}. Check that the Kaggle notebook's API cell is still running and that this URL matches the "Public API URL" it printed most recently - it changes every time the notebook restarts.`,
      { network: true }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = res.statusText || 'Request failed';
    let gpuStatus = null;
    try {
      const body = await res.json();
      const raw = body.detail ?? body.error ?? detail;
      if (raw && typeof raw === 'object' && raw.message) {
        detail = raw.message;
        gpuStatus = raw.gpu_status || null;
      } else {
        detail = typeof raw === 'string' ? raw : JSON.stringify(raw);
      }
    } catch {
      // Response wasn't JSON - keep statusText.
    }
    // 401 / 409 carry a sentence written for people; other codes keep the status for debugging.
    const message = res.status === 401 || res.status === 409 ? detail : `${res.status}: ${detail}`;
    throw new ApiError(message, { status: res.status, gpuStatus });
  }
  return res.json();
}

/**
 * Pings /health. Used by Settings' "Test connection" and the sidebar status dot.
 */
export async function checkHealth() {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return { ok: false, reason: 'no_url' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** Verifies the saved access code against the backend. Resolves when accepted. */
export async function verifyAccessCode() {
  return request('/auth', { timeoutMs: HEALTH_TIMEOUT_MS });
}

/**
 * <video src> can't send the ngrok-skip-browser-warning header, so a raw ngrok
 * media URL gets the interstitial HTML page instead of the file and the player
 * silently shows a black frame. Fetching it as a blob with the header and
 * handing the player an object URL sidesteps that. The caller must revoke the
 * returned blob: URL when finished with it.
 */
export async function fetchMediaObjectUrl(url) {
  if (!url) return null;
  if (isMockModeActive() || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
  if (!res.ok) {
    throw new Error(`Could not load the video (${res.status}). It may still be finishing on the Kaggle side.`);
  }
  return URL.createObjectURL(await res.blob());
}

// ---- Polling ----------------------------------------------------------------

/**
 * Polls GET /jobs/{id} until `isTerminal(data)` is true. One dropped request
 * (an ngrok blip, a slow Kaggle response) no longer kills a 5-9 minute
 * generation: transient failures back off and retry, and only a definitive
 * answer (job gone, 4xx) or several failures in a row is reported as an error.
 * Returns a cancel function; after cancelling, onUpdate is never called again.
 */
function createPoller(jobId, isTerminal, onUpdate) {
  let cancelled = false;
  let timeoutId = null;
  let failures = 0;

  async function tick() {
    if (cancelled) return;

    let data;
    try {
      data = await request(`/jobs/${jobId}`);
      failures = 0;
    } catch (err) {
      if (cancelled) return;
      failures += 1;
      const definitive = err.status >= 400 && err.status < 500;
      if (definitive || failures >= MAX_POLL_FAILURES) {
        onUpdate({
          stage: 'error',
          error: err.status === 404
            ? 'The backend no longer has this job - the Kaggle session was probably restarted. Start a new post.'
            : err.message,
        });
        return;
      }
      timeoutId = setTimeout(tick, Math.min(JOB_POLL_INTERVAL_MS * 2 ** failures, MAX_POLL_BACKOFF_MS));
      return;
    }

    if (cancelled) return;
    onUpdate(data);
    if (cancelled || isTerminal(data)) return;
    timeoutId = setTimeout(tick, JOB_POLL_INTERVAL_MS);
  }

  tick();
  return () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}

// ---- Demo mode (no network) -------------------------------------------------

const MOCK_STEP_DURATIONS = {
  planning: 3000,
  generating_video: 7500,
  finalizing: 1500,
};

function mockPipeline(topic, onUpdate) {
  const stages = ['planning', 'generating_video', 'finalizing'];
  const total = Object.values(MOCK_STEP_DURATIONS).reduce((a, b) => a + b, 0);
  const t0 = Date.now();
  let cancelled = false;

  const topicClean = topic
    .replace(/^generate content for /i, '')
    .replace(/^post about /i, '')
    .replace(/^share a? ?/i, '')
    .replace(/^announce /i, '');
  const caption = `Celebrating ${topicClean}. Crafted with Venpa Connections - bringing our community together with a story worth sharing.`;
  const hashtags = ['#VenpaConnections', '#AIAutomation', '#SocialMedia'];

  const timer = setInterval(() => {
    if (cancelled) return;
    const elapsed = Date.now() - t0;
    if (elapsed >= total) {
      clearInterval(timer);
      onUpdate({ stage: 'done', progress: 100, video_prompt: `A cinematic scene representing: ${topicClean}`, caption, hashtags, video_url: null });
      return;
    }
    let acc = 0;
    let stage = stages[stages.length - 1];
    for (const s of stages) {
      acc += MOCK_STEP_DURATIONS[s];
      if (elapsed < acc) { stage = s; break; }
    }
    onUpdate({ stage, progress: Math.min(99, Math.round((elapsed / total) * 100)) });
  }, 150);

  return () => { cancelled = true; clearInterval(timer); };
}

// ---- Public API -------------------------------------------------------------

/** POST /jobs { topic } -> { job_id, owner_token }. Rejects with status 409 while the GPU is in use. */
export async function createJob(topic) {
  if (isMockModeActive()) return { job_id: `mock-${Date.now()}` };
  return request('/jobs', { method: 'POST', body: JSON.stringify({ topic }) });
}

/**
 * Polls a job until it is 'done', 'error', 'cancelled' or 'posted'. Calls onUpdate on every
 * poll (the payload can also be a resumed job that is already 'publishing').
 */
export function pollJob(jobId, onUpdate, { mockTopic } = {}) {
  if (isMockModeActive()) return mockPipeline(mockTopic || '', onUpdate);
  return createPoller(jobId, (d) => ['done', 'error', 'posted', 'cancelled'].includes(d.stage), onUpdate);
}

/** POST /jobs/{id}/publish -> { stage: 'publishing' } */
export async function publishJob(jobId) {
  if (isMockModeActive()) return { stage: 'publishing' };
  return request(`/jobs/${jobId}/publish`, { method: 'POST' });
}

/** Polls a publishing job until it is 'posted' or 'error'. */
export function pollPublish(jobId, onUpdate) {
  if (isMockModeActive()) {
    const t = setTimeout(() => onUpdate({ stage: 'posted', post_url: null }), 1800);
    return () => clearTimeout(t);
  }
  return createPoller(jobId, (d) => d.stage === 'posted' || d.stage === 'error', onUpdate);
}

// ---- Run ownership: heartbeat, leave, cancel ---------------------------------
// The backend gives whoever starts a run an owner token. While the run is on the
// GPU the page pings /heartbeat; if the pings stop (tab closed, connection lost)
// the backend stops the run and frees the GPU for the next visitor.

export function heartbeatJob(jobId, ownerToken) {
  return request(`/jobs/${jobId}/heartbeat`, { method: 'POST', body: JSON.stringify({ owner_token: ownerToken }), timeoutMs: HEALTH_TIMEOUT_MS });
}

export function cancelJob(jobId, ownerToken) {
  return request(`/jobs/${jobId}/cancel`, { method: 'POST', body: JSON.stringify({ owner_token: ownerToken }) });
}

/**
 * Fire-and-forget notice that the page is unloading. `keepalive` lets the
 * request finish after the page is gone; if it is lost anyway, the heartbeat
 * lease on the backend expires and stops the run a little later.
 */
export function leaveJob(jobId, ownerToken) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl || !jobId || !ownerToken) return;
  try {
    fetch(`${baseUrl}/jobs/${jobId}/leave`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', ...accessHeaders() },
      body: JSON.stringify({ owner_token: ownerToken }),
    }).catch(() => {});
  } catch {
    // Nothing else to do while unloading.
  }
}

// ---- History: every run the backend knows about ------------------------------

const RUNNING_STAGES = ['planning', 'generating_video', 'finalizing'];

const STATUS_BY_STAGE = {
  planning: { label: 'Generating', tone: 'outline' },
  generating_video: { label: 'Generating', tone: 'outline' },
  finalizing: { label: 'Generating', tone: 'outline' },
  done: { label: 'Ready to review', tone: 'accent' },
  publishing: { label: 'Posting', tone: 'outline' },
  posted: { label: 'Posted', tone: 'accent' },
  error: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Stopped', tone: 'muted' },
};

function formatRunDate(seconds) {
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function normalizeRun(job) {
  const status = STATUS_BY_STAGE[job.stage] || { label: job.stage || 'Unknown', tone: 'muted' };
  return {
    id: job.id,
    topic: job.topic || 'Untitled post',
    date: formatRunDate(job.created_at || job.updated_at),
    sortKey: job.created_at || job.updated_at || 0,
    stage: job.stage,
    running: RUNNING_STAGES.includes(job.stage),
    status: status.label,
    tone: status.tone,
    progress: job.progress ?? 0,
    caption: job.caption || '',
    videoUrl: job.video_url || null,
    postUrl: job.post_url || null,
    error: job.error || '',
    source: job.source || 'visitor',
    thumbnailUrl: null,
  };
}

function normalizePost(post, index) {
  return {
    id: post.id ?? `${post.date || 'post'}-${index}`,
    topic: post.topic || 'Untitled post',
    date: post.date || '',
    sortKey: 0,
    stage: 'posted',
    running: false,
    status: post.status || 'Posted',
    tone: 'accent',
    progress: 100,
    caption: '',
    videoUrl: null,
    postUrl: null,
    error: '',
    source: 'visitor',
    thumbnailUrl: post.thumbnailUrl || post.thumbnail_url || null,
  };
}

/**
 * GET /jobs (every run, including ones in progress and failed ones) merged with
 * GET /posts (older posted entries the backend saved before /jobs existed).
 */
export async function listPosts() {
  if (isMockModeActive()) {
    return [
      { id: 1, topic: 'Independence Day greetings', date: 'Aug 15, 2026', status: 'Posted' },
      { id: 2, topic: 'Diwali wishes for clients', date: 'Nov 1, 2025', status: 'Posted' },
      { id: 3, topic: 'Pongal festival post', date: 'Jan 14, 2026', status: 'Posted' },
    ].map(normalizePost);
  }
  const [jobsResult, postsResult] = await Promise.allSettled([request('/jobs'), request('/posts')]);
  if (jobsResult.status === 'rejected' && postsResult.status === 'rejected') throw jobsResult.reason;

  const runs = jobsResult.status === 'fulfilled' && Array.isArray(jobsResult.value) ? jobsResult.value.map(normalizeRun) : [];
  const known = new Set(runs.map((run) => String(run.id)));
  const older = postsResult.status === 'fulfilled' && Array.isArray(postsResult.value)
    ? postsResult.value.map(normalizePost).filter((post) => !known.has(String(post.id)))
    : [];
  return [...runs, ...older];
}

// ---- Shared schedule (backend section 5b) -----------------------------------

/** Timezone the backend should use to decide when a scheduled time is due. */
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** GET /schedule -> { mode, tz, items } */
export async function getRemoteSchedule() {
  return request('/schedule');
}

/**
 * PUT /schedule { items?, mode?, tz? } -> merged schedule. The backend keeps
 * ownership of generating/ready items, so a stale copy can't overwrite them.
 */
export async function putRemoteSchedule(payload) {
  return request('/schedule', {
    method: 'PUT',
    body: JSON.stringify({ tz: browserTimeZone(), tz_offset_minutes: -new Date().getTimezoneOffset(), ...payload }),
  });
}
