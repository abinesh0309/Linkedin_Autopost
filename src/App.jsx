import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import NewPostView from './components/NewPostView.jsx';
import ProgressView from './components/ProgressView.jsx';
import ReviewView from './components/ReviewView.jsx';
import PublishingView from './components/PublishingView.jsx';
import PostedView from './components/PostedView.jsx';
import {
  createJob, pollJob, publishJob, pollPublish, listPosts, isMockModeActive, checkHealth,
  getRemoteSchedule, putRemoteSchedule,
} from './services/api.js';
import { loadSchedule, saveSchedule, toDateKey, compareItems } from './services/schedule.js';

// Secondary screens are split into their own chunks so the first paint only
// downloads what the New Post flow needs.
const HistoryView = lazy(() => import('./components/HistoryView.jsx'));
const ScheduleView = lazy(() => import('./components/ScheduleView.jsx'));
const SettingsView = lazy(() => import('./components/SettingsView.jsx'));

const ACTIVE_JOB_KEY = 'vc_active_job';
const HEALTH_INTERVAL_MS = 20000;
const SCHEDULE_SYNC_INTERVAL_MS = 30000;

// The in-flight job survives a page refresh (sessionStorage), so an accidental
// reload during a 5-9 minute generation resumes instead of losing the run.
function readActiveJob() {
  try {
    return JSON.parse(sessionStorage.getItem(ACTIVE_JOB_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeActiveJob(value) {
  try {
    if (value) sessionStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(ACTIVE_JOB_KEY);
  } catch {
    // Best-effort only.
  }
}

// flowStep: 'input' -> 'progress' -> 'review' -> 'publishing' -> 'posted'
export default function App({ initialNotice = '' }) {
  const [view, setView] = useState('new');
  const [flowStep, setFlowStep] = useState('input');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [publishError, setPublishError] = useState('');

  const [stage, setStage] = useState('planning');
  const [progress, setProgress] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [videoUrl, setVideoUrl] = useState(null);
  const [postUrl, setPostUrl] = useState(null);

  const [posts, setPosts] = useState([]);
  const [postsState, setPostsState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [backendOnline, setBackendOnline] = useState(false);
  // Bumped whenever the backend URL changes so health + history re-check.
  const [apiVersion, setApiVersion] = useState(0);

  const [schedule, setSchedule] = useState(loadSchedule);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [notice, setNotice] = useState(initialNotice);
  // Shared schedule: 'local' (demo mode) | 'syncing' | 'synced' | 'error' | 'unsupported'
  const [scheduleMode, setScheduleMode] = useState('off');
  const [syncState, setSyncState] = useState('local');

  const cancelPollRef = useRef(null);
  const jobRef = useRef({ id: null, topic: '', scheduleId: null });
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  const editSeqRef = useRef(0);       // bumps on every local edit
  const pendingRef = useRef(false);   // local edits not yet pushed to the backend
  const syncingRef = useRef(false);
  const firstSyncRef = useRef(false);
  const pushTimerRef = useRef(null);

  const mockMode = useMemo(() => isMockModeActive(), [apiVersion]);
  const todayKey = toDateKey();
  const dueItems = schedule
    .filter((item) => item.status === 'planned' && item.date <= todayKey)
    .sort(compareItems);
  const readyItems = schedule.filter((item) => item.status === 'ready');
  const attentionCount = dueItems.length + readyItems.length;
  const linkedItem = schedule.find((item) => item.id === activeScheduleId) || null;
  const busy = flowStep === 'progress' || flowStep === 'publishing';

  // ---- Polling plumbing (only touches setters and refs, so it is safe to call
  // from callbacks created on an earlier render) --------------------------------

  function stopPolling() {
    if (cancelPollRef.current) {
      cancelPollRef.current();
      cancelPollRef.current = null;
    }
  }

  function handlePosted(data) {
    stopPolling();
    writeActiveJob(null);
    setPostUrl(data.post_url || null);
    const { topic, scheduleId } = jobRef.current;
    setPosts((prev) => [{ id: `local-${Date.now()}`, topic, date: 'Just now', status: 'Posted', thumbnailUrl: null }, ...prev]);
    if (scheduleId) {
      commitSchedule((prev) => prev.map((item) => (item.id === scheduleId ? { ...item, status: 'posted', postedAt: Date.now() } : item)));
    }
    setFlowStep('posted');
    if (!isMockModeActive()) loadPosts({ silent: true });
  }

  function beginPublishPolling(jobId) {
    stopPolling();
    writeActiveJob({ jobId, prompt: jobRef.current.topic, scheduleId: jobRef.current.scheduleId, phase: 'publishing' });
    setFlowStep('publishing');
    cancelPollRef.current = pollPublish(jobId, (data) => {
      if (data.stage === 'error') {
        stopPolling();
        writeActiveJob({ jobId, prompt: jobRef.current.topic, scheduleId: jobRef.current.scheduleId, phase: 'generating' });
        setPublishError(data.error || 'Publishing to LinkedIn failed.');
        setFlowStep('review');
        return;
      }
      if (data.stage === 'posted') handlePosted(data);
    });
  }

  function handleGenerateUpdate(data) {
    if (data.stage === 'error') {
      stopPolling();
      writeActiveJob(null);
      setError(data.error || 'Something went wrong while generating the post.');
      setFlowStep('input');
      return;
    }
    // A resumed job may already be past generation.
    if (data.stage === 'publishing') { beginPublishPolling(jobRef.current.id); return; }
    if (data.stage === 'posted') { handlePosted(data); return; }

    setStalled(Boolean(data.stalled));
    setStage(data.stage);
    setProgress(data.progress ?? 0);
    if (data.stage === 'done') {
      setStalled(false);
      setCaption(data.caption || '');
      setHashtags(data.hashtags || []);
      setVideoUrl(data.video_url || null);
      setFlowStep('review');
    }
  }

  const loadPosts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setPostsState('loading');
    try {
      setPosts(await listPosts());
      setPostsState('ready');
    } catch {
      if (!silent) setPostsState('error');
    }
  }, []);

  // ---- Schedule sync ------------------------------------------------------------
  // The backend is the source of truth while connected (its worker changes item
  // statuses on its own), and the browser copy is the fallback. Local edits are
  // pushed after a short pause; otherwise the plan is pulled every 30 seconds.

  function applyRemote(doc) {
    setSchedule(Array.isArray(doc.items) ? doc.items : []);
    if (doc.mode) setScheduleMode(doc.mode);
  }

  async function syncNow() {
    if (isMockModeActive() || syncingRef.current) return;
    syncingRef.current = true;
    const seq = editSeqRef.current;
    try {
      let doc = null;
      if (!pendingRef.current) {
        doc = await getRemoteSchedule();
        // First connection with an empty backend: upload the plan made offline.
        if (!firstSyncRef.current && (doc.items || []).length === 0 && scheduleRef.current.length > 0) {
          pendingRef.current = true;
        }
      }
      firstSyncRef.current = true;
      if (pendingRef.current) {
        doc = await putRemoteSchedule({ items: scheduleRef.current });
      }
      if (editSeqRef.current === seq) {
        pendingRef.current = false;
        applyRemote(doc);
        setSyncState('synced');
      } else {
        // Edited while the request was in flight: keep the newer local copy and push again.
        setTimeout(syncNow, 300);
      }
    } catch (err) {
      setSyncState(err && err.status === 404 ? 'unsupported' : 'error');
    } finally {
      syncingRef.current = false;
    }
  }

  // Every local change to the plan goes through here.
  function commitSchedule(updater) {
    editSeqRef.current += 1;
    pendingRef.current = !isMockModeActive();
    setSchedule(updater);
    clearTimeout(pushTimerRef.current);
    if (pendingRef.current) pushTimerRef.current = setTimeout(syncNow, 700);
  }

  async function changeScheduleMode(mode) {
    const previous = scheduleMode;
    setScheduleMode(mode);
    try {
      const doc = await putRemoteSchedule({ mode });
      setScheduleMode(doc.mode);
      setNotice(mode === 'off' ? 'Schedule automation turned off.' : 'Schedule automation updated.');
    } catch (err) {
      setScheduleMode(previous);
      setNotice(err.message || 'Could not change the schedule mode.');
    }
  }

  // ---- Effects ---------------------------------------------------------------

  useEffect(() => { loadPosts(); }, [loadPosts, apiVersion]);

  // Keeps the sidebar dot honest without hammering the backend: pauses while
  // the tab is hidden and re-checks the moment it becomes visible again.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (document.hidden) return;
      if (isMockModeActive()) {
        if (!cancelled) setBackendOnline(false);
        return;
      }
      const result = await checkHealth();
      if (!cancelled) setBackendOnline(result.ok);
    }
    check();
    const interval = setInterval(check, HEALTH_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, [apiVersion]);

  // Resume a job that was running when the page was refreshed.
  useEffect(() => {
    const saved = readActiveJob();
    if (!saved || !saved.jobId) return;
    if (isMockModeActive()) { writeActiveJob(null); return; }
    jobRef.current = { id: saved.jobId, topic: saved.prompt || '', scheduleId: saved.scheduleId || null };
    setPrompt(saved.prompt || '');
    setActiveScheduleId(saved.scheduleId || null);
    if (saved.phase === 'publishing') {
      beginPublishPolling(saved.jobId);
    } else {
      setFlowStep('progress');
      cancelPollRef.current = pollJob(saved.jobId, handleGenerateUpdate);
    }
  }, []);

  useEffect(() => () => stopPolling(), []);
  useEffect(() => { saveSchedule(schedule); }, [schedule]);

  useEffect(() => {
    firstSyncRef.current = false;
    pendingRef.current = false;
    if (mockMode) { setSyncState('local'); setScheduleMode('off'); return undefined; }
    setSyncState('syncing');
    const tick = () => { if (!document.hidden) syncNow(); };
    tick();
    const interval = setInterval(tick, SCHEDULE_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      clearTimeout(pushTimerRef.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [apiVersion]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // ---- Actions ---------------------------------------------------------------

  async function startGenerate() {
    const topic = prompt.trim();
    if (!topic) return;
    stopPolling();
    setError('');
    setPublishError('');
    setStalled(false);
    setFlowStep('progress');
    setStage('planning');
    setProgress(0);

    try {
      const { job_id } = await createJob(topic);
      jobRef.current = { id: job_id, topic, scheduleId: activeScheduleId };
      writeActiveJob({ jobId: job_id, prompt: topic, scheduleId: activeScheduleId, phase: 'generating' });
      cancelPollRef.current = pollJob(job_id, handleGenerateUpdate, { mockTopic: topic });
    } catch (err) {
      setError(err.message);
      setFlowStep('input');
    }
  }

  async function acceptPost() {
    const jobId = jobRef.current.id;
    if (!jobId) return;
    setPublishError('');
    setFlowStep('publishing');
    try {
      await publishJob(jobId);
      beginPublishPolling(jobId);
    } catch (err) {
      setPublishError(err.message);
      setFlowStep('review');
    }
  }

  function resetFlow() {
    stopPolling();
    writeActiveJob(null);
    jobRef.current = { id: null, topic: '', scheduleId: null };
    setFlowStep('input');
    setPrompt('');
    setError('');
    setPublishError('');
    setStalled(false);
    setActiveScheduleId(null);
    setCaption('');
    setHashtags([]);
    setVideoUrl(null);
    setPostUrl(null);
  }

  function startFromSchedule(item) {
    if (busy) return;
    if (flowStep === 'review' && !window.confirm('Discard the post that is waiting for review and start this one instead?')) return;
    resetFlow();
    setPrompt(item.topic);
    setActiveScheduleId(item.id);
    setView('new');
  }

  // A scheduled item the backend has generated (or is generating): pick it up in the normal flow.
  function reviewScheduled(item) {
    if (busy || !item.job_id) return;
    if (flowStep === 'review' && !window.confirm('Discard the post that is waiting for review and open this one instead?')) return;
    resetFlow();
    jobRef.current = { id: item.job_id, topic: item.topic, scheduleId: item.id };
    writeActiveJob({ jobId: item.job_id, prompt: item.topic, scheduleId: item.id, phase: 'generating' });
    setPrompt(item.topic);
    setActiveScheduleId(item.id);
    setFlowStep('progress');
    cancelPollRef.current = pollJob(item.job_id, handleGenerateUpdate);
    setView('new');
  }

  function handleConnectionChanged() {
    setApiVersion((v) => v + 1);
  }

  function handleSettingsSaved() {
    setApiVersion((v) => v + 1);
    setNotice('Backend connection saved.');
    setView('new');
  }

  const addScheduleItems = (items) => commitSchedule((prev) => [...prev, ...items]);
  const updateScheduleItem = (id, patch) => commitSchedule((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const removeScheduleItem = (id) => commitSchedule((prev) => prev.filter((item) => item.id !== id));

  return (
    <div className="vc-shell">
      <a className="vc-skip" href="#main">Skip to content</a>
      <Sidebar view={view} onNavigate={setView} backendOnline={backendOnline} mockMode={mockMode} dueCount={attentionCount} />

      <main id="main" className="vc-main">
        <div className="vc-main-inner">
          {view === 'new' && (
            <>
              {flowStep === 'input' && (
                <NewPostView
                  prompt={prompt}
                  setPrompt={setPrompt}
                  onGenerate={startGenerate}
                  error={error}
                  backendOnline={backendOnline}
                  mockMode={mockMode}
                  onOpenSettings={() => setView('settings')}
                  dueItems={dueItems}
                  readyItems={readyItems}
                  onReviewScheduled={reviewScheduled}
                  linkedItem={linkedItem}
                  onUseScheduled={startFromSchedule}
                  onOpenSchedule={() => setView('schedule')}
                />
              )}
              {flowStep === 'progress' && <ProgressView prompt={prompt} stage={stage} overallPercent={progress} stalled={stalled} />}
              {flowStep === 'review' && (
                <ReviewView
                  caption={caption}
                  hashtags={hashtags}
                  videoUrl={videoUrl}
                  onAccept={acceptPost}
                  onRegenerate={startGenerate}
                  publishError={publishError}
                />
              )}
              {flowStep === 'publishing' && <PublishingView />}
              {flowStep === 'posted' && <PostedView prompt={prompt} postUrl={postUrl} onCreateAnother={resetFlow} />}
            </>
          )}

          <Suspense fallback={<div className="vc-loading">Loading&hellip;</div>}>
            {view === 'history' && <HistoryView posts={posts} state={postsState} onRetry={() => loadPosts()} />}
            {view === 'schedule' && (
              <ScheduleView
                items={schedule}
                busy={busy}
                onAdd={addScheduleItems}
                onUpdate={updateScheduleItem}
                onRemove={removeScheduleItem}
                onGenerate={startFromSchedule}
                onReview={reviewScheduled}
                mode={scheduleMode}
                onModeChange={changeScheduleMode}
                syncState={syncState}
                mockMode={mockMode}
              />
            )}
            {view === 'settings' && <SettingsView onChanged={handleConnectionChanged} onSaved={handleSettingsSaved} />}
          </Suspense>
        </div>
      </main>

      {notice && <div className="vc-toast" role="status">{notice}</div>}
    </div>
  );
}
