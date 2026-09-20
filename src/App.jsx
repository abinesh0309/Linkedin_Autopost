import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import NewPostView from './components/NewPostView.jsx';
import ProgressView from './components/ProgressView.jsx';
import ReviewView from './components/ReviewView.jsx';
import PublishingView from './components/PublishingView.jsx';
import PostedView from './components/PostedView.jsx';
import ConnectGate from './components/ConnectGate.jsx';
import {
  createJob, pollJob, publishJob, pollPublish, listPosts, isMockModeActive, isBackendRequired, checkHealth,
  verifyAccessCode, heartbeatJob, cancelJob, leaveJob, getRemoteSchedule, putRemoteSchedule,
} from './services/api.js';
import { loadSchedule, saveSchedule, toDateKey, compareItems } from './services/schedule.js';

// Secondary screens are split into their own chunks so the first paint only
// downloads what the New Post flow needs.
const HistoryView = lazy(() => import('./components/HistoryView.jsx'));
const ScheduleView = lazy(() => import('./components/ScheduleView.jsx'));
const SettingsView = lazy(() => import('./components/SettingsView.jsx'));

const ACTIVE_JOB_KEY = 'vc_active_job';
const HEALTH_INTERVAL_MS = 6000;      // also drives the "GPU in use" banner for other visitors
const HEARTBEAT_INTERVAL_MS = 10000;  // tells the backend the page that started a run is still open
const HISTORY_REFRESH_MS = 5000;
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
  const [healthChecked, setHealthChecked] = useState(false);
  const [everConnected, setEverConnected] = useState(false); // connected at least once since this page loaded
  const [lastCheckAt, setLastCheckAt] = useState(0);
  const [needsCode, setNeedsCode] = useState(false);
  const [gpuStatus, setGpuStatus] = useState(null);
  const [stopping, setStopping] = useState(false);
  // Bumped whenever the backend URL changes so health + history re-check.
  const [apiVersion, setApiVersion] = useState(0);

  const [schedule, setSchedule] = useState(loadSchedule);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [notice, setNotice] = useState(initialNotice);
  // Shared schedule: 'local' (demo mode) | 'syncing' | 'synced' | 'error' | 'unsupported'
  const [scheduleMode, setScheduleMode] = useState('off');
  const [syncState, setSyncState] = useState('local');

  const cancelPollRef = useRef(null);
  const jobRef = useRef({ id: null, topic: '', scheduleId: null, ownerToken: null });
  const flowStepRef = useRef('input');
  const stoppingRef = useRef(false);
  const failuresRef = useRef(0);
  const authOkRef = useRef(false);
  const everOnlineRef = useRef(false);
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  const editSeqRef = useRef(0);       // bumps on every local edit
  const pendingRef = useRef(false);   // local edits not yet pushed to the backend
  const syncingRef = useRef(false);
  const firstSyncRef = useRef(false);
  const pushTimerRef = useRef(null);

  flowStepRef.current = flowStep;
  const requireBackend = isBackendRequired();
  const mockMode = useMemo(() => isMockModeActive(), [apiVersion]);
  const todayKey = toDateKey();
  const dueItems = schedule
    .filter((item) => item.status === 'planned' && item.date <= todayKey)
    .sort(compareItems);
  const readyItems = schedule.filter((item) => item.status === 'ready');
  const attentionCount = dueItems.length + readyItems.length;
  const linkedItem = schedule.find((item) => item.id === activeScheduleId) || null;
  const busy = flowStep === 'progress' || flowStep === 'publishing';
  // Someone else's run is on the GPU (a run of mine is shown in the progress view instead).
  const gpuBusyByOther = Boolean(gpuStatus && gpuStatus.busy && gpuStatus.job_id !== jobRef.current.id);
  const connState = !healthChecked ? 'checking' : !backendOnline ? 'offline' : needsCode ? 'needs_code' : 'online';
  // A run in flight keeps the app on screen through a short connection blip - but only
  // once we have been connected; a page that reloads while the backend is down shows the gate.
  const showGate = requireBackend && connState !== 'online' && !(busy && everConnected);

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
    setPosts((prev) => [{
      id: `local-${Date.now()}`, topic, date: 'Just now', stage: 'posted', running: false, status: 'Posted', tone: 'accent',
      progress: 100, caption: '', videoUrl: null, postUrl: data.post_url || null, error: '', source: 'visitor', thumbnailUrl: null,
    }, ...prev]);
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
    if (data.stage === 'cancelled') {
      stopPolling();
      writeActiveJob(null);
      if (stoppingRef.current) setNotice('Generation stopped. The GPU is free.');
      else setError(data.error || 'This run was stopped.');
      stoppingRef.current = false;
      setStopping(false);
      setFlowStep('input');
      return;
    }
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

  // Reload history whenever the connection is (re)established, and keep it fresh
  // while the History screen is open so other visitors' runs show up live.
  const readyForData = mockMode || (backendOnline && !needsCode);
  useEffect(() => { if (readyForData) loadPosts(); }, [loadPosts, apiVersion, readyForData]);
  useEffect(() => {
    if (view !== 'history' || mockMode || !readyForData) return undefined;
    const interval = setInterval(() => { if (!document.hidden) loadPosts({ silent: true }); }, HISTORY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [view, mockMode, readyForData, loadPosts]);

  // Keeps the sidebar dot honest without hammering the backend: pauses while
  // the tab is hidden and re-checks the moment it becomes visible again. The
  // same response says whether the GPU is in use, so every visitor sees it.
  useEffect(() => {
    let cancelled = false;
    failuresRef.current = 0;
    authOkRef.current = false;
    everOnlineRef.current = false;
    setHealthChecked(false);
    async function check() {
      if (document.hidden) return;
      if (isMockModeActive()) {
        if (!cancelled) { setBackendOnline(false); setGpuStatus(null); setHealthChecked(true); }
        return;
      }
      const result = await checkHealth();
      if (cancelled) return;
      setLastCheckAt(Date.now());
      if (!result.ok) {
        failuresRef.current += 1;
        // One dropped request is not an outage once we were connected.
        if (failuresRef.current >= 2 || !everOnlineRef.current) { setBackendOnline(false); setGpuStatus(null); }
        setHealthChecked(true);
        return;
      }
      failuresRef.current = 0;
      everOnlineRef.current = true;
      setEverConnected(true);
      setGpuStatus(result.data.gpu_status || { busy: false });
      if (result.data.auth_required && !authOkRef.current) {
        try {
          await verifyAccessCode();
          authOkRef.current = true;
        } catch (err) {
          if (cancelled) return;
          if (err && err.status === 401) { setNeedsCode(true); setBackendOnline(true); setHealthChecked(true); return; }
        }
      }
      if (cancelled) return;
      setNeedsCode(false);
      setBackendOnline(true);
      setHealthChecked(true);
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

  // While a run started from this page is on the GPU, keep telling the backend
  // the page is still here. If the page closes or the pings stop, the backend
  // cancels the run instead of burning GPU time for nobody.
  useEffect(() => {
    if (flowStep !== 'progress' || mockMode) return undefined;
    const beat = () => {
      const { id, ownerToken } = jobRef.current;
      if (id && ownerToken) heartbeatJob(id, ownerToken).catch(() => {});
    };
    const onVisible = () => { if (!document.hidden) beat(); };
    beat();
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', beat);
    };
  }, [flowStep, mockMode]);

  useEffect(() => {
    const onLeave = () => {
      const { id, ownerToken } = jobRef.current;
      if (flowStepRef.current === 'progress' && id && ownerToken && !isMockModeActive()) leaveJob(id, ownerToken);
    };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, []);

  // Resume a job that was running when the page was refreshed.
  useEffect(() => {
    const saved = readActiveJob();
    if (!saved || !saved.jobId) return;
    if (isMockModeActive()) { writeActiveJob(null); return; }
    jobRef.current = { id: saved.jobId, topic: saved.prompt || '', scheduleId: saved.scheduleId || null, ownerToken: saved.ownerToken || null };
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
  }, [apiVersion, backendOnline]);

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
    stoppingRef.current = false;
    setStopping(false);
    jobRef.current = { id: null, topic, scheduleId: activeScheduleId, ownerToken: null };
    setFlowStep('progress');
    setStage('planning');
    setProgress(0);

    try {
      const { job_id, owner_token: ownerToken = null } = await createJob(topic);
      jobRef.current = { id: job_id, topic, scheduleId: activeScheduleId, ownerToken };
      writeActiveJob({ jobId: job_id, prompt: topic, scheduleId: activeScheduleId, phase: 'generating', ownerToken });
      cancelPollRef.current = pollJob(job_id, handleGenerateUpdate, { mockTopic: topic });
    } catch (err) {
      if (err && err.status === 409 && err.gpuStatus) setGpuStatus(err.gpuStatus);
      if (err && err.status === 401) setNeedsCode(true);
      setError(err.message);
      setFlowStep('input');
    }
  }

  // "Stop" button: the backend halts the run between diffusion steps and frees the GPU.
  async function stopGenerate() {
    const { id, ownerToken } = jobRef.current;
    if (!id || !ownerToken || stoppingRef.current) return;
    stoppingRef.current = true;
    setStopping(true);
    try {
      await cancelJob(id, ownerToken);
    } catch (err) {
      stoppingRef.current = false;
      setStopping(false);
      setNotice(err.message || 'Could not stop the run.');
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
    stoppingRef.current = false;
    setStopping(false);
    jobRef.current = { id: null, topic: '', scheduleId: null, ownerToken: null };
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

  // A run the backend already has (a scheduled item, or one from History): open it
  // in the normal flow. A finished one goes straight to review; a running one shows progress.
  function openJob(jobId, topic, scheduleId = null) {
    if (busy || !jobId) return;
    if (flowStep === 'review' && !window.confirm('Discard the post that is waiting for review and open this one instead?')) return;
    resetFlow();
    jobRef.current = { id: jobId, topic, scheduleId, ownerToken: null };
    writeActiveJob({ jobId, prompt: topic, scheduleId, phase: 'generating' });
    setPrompt(topic);
    setActiveScheduleId(scheduleId);
    setFlowStep('progress');
    cancelPollRef.current = pollJob(jobId, handleGenerateUpdate);
    setView('new');
  }

  const reviewScheduled = (item) => openJob(item.job_id, item.topic, item.id);
  const openRun = (run) => openJob(run.id, run.topic, null);

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

  if (showGate) {
    return <ConnectGate state={connState} lastCheckAt={lastCheckAt} onChanged={handleConnectionChanged} />;
  }

  return (
    <div className="vc-shell">
      <a className="vc-skip" href="#main">Skip to content</a>
      <Sidebar
        view={view}
        onNavigate={setView}
        backendOnline={backendOnline}
        mockMode={mockMode}
        dueCount={attentionCount}
        gpuStatus={gpuStatus}
        needsCode={needsCode}
        gpuIsMine={Boolean(gpuStatus && gpuStatus.busy && !gpuBusyByOther)}
      />

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
                  gpuStatus={gpuBusyByOther ? gpuStatus : null}
                  needsCode={needsCode}
                  onOpenSettings={() => setView('settings')}
                  dueItems={dueItems}
                  readyItems={readyItems}
                  onReviewScheduled={reviewScheduled}
                  linkedItem={linkedItem}
                  onUseScheduled={startFromSchedule}
                  onOpenSchedule={() => setView('schedule')}
                />
              )}
              {flowStep === 'progress' && (
                <ProgressView
                  prompt={prompt}
                  stage={stage}
                  overallPercent={progress}
                  stalled={stalled}
                  canStop={Boolean(jobRef.current.ownerToken) && !mockMode}
                  stopping={stopping}
                  onStop={stopGenerate}
                />
              )}
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
            {view === 'history' && (
              <HistoryView
                posts={posts}
                state={postsState}
                onRetry={() => loadPosts()}
                onOpenRun={openRun}
                busy={busy}
                needsCode={needsCode}
              />
            )}
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
