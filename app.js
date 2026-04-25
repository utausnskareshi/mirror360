'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  view: 'welcome',
  stream: null,
  recorder: null,
  recordedChunks: [],
  recordedUrl: null,
  recordedMime: '',
  duration: 3,
  facingMode: 'user',
  mirrored: true,
  zoom: 1,
  brightnessOn: false,
  gridOn: false,
  frozen: false,
  loop: true,
  wakeLock: null,
  installPrompt: null,
  recording: false,
  recordTimer: null,
  recordStart: 0
};

const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);

// ============================================================
// Init
// ============================================================
function init() {
  if (isIOS) $('#android-install').style.display = 'none';
  else if (isAndroid) $('#ios-install').style.display = 'none';

  if (localStorage.getItem('m360_skipWelcome') === '1') {
    showView('mirror');
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installPrompt = e;
    $('#installBtn').hidden = false;
  });

  $('#installBtn').addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $('#installBtn').hidden = true;
  });

  $('#startBtn').addEventListener('click', () => {
    if ($('#dontShow').checked) localStorage.setItem('m360_skipWelcome', '1');
    showView('mirror');
  });

  // Mirror controls
  $('#helpBtn').addEventListener('click', () => showView('welcome'));
  $('#settingsBtn').addEventListener('click', () => {
    $('#settingsPanel').classList.toggle('hidden');
  });
  $$('.dur').forEach((b) => b.addEventListener('click', () => {
    $$('.dur').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    state.duration = parseInt(b.dataset.dur, 10);
  }));
  $('#switchCamera').addEventListener('click', switchCamera);
  $('#brightBtn').addEventListener('click', toggleBrightness);
  $('#gridBtn').addEventListener('click', toggleGrid);
  $('#freezeBtn').addEventListener('click', toggleFreeze);
  $('#mirrorBtn').addEventListener('click', toggleMirrorFlip);
  $('#captureBtn').addEventListener('click', captureLiveStill);
  $('#recordBtn').addEventListener('click', () => {
    if (state.recording) stopRecording();
    else startRecording();
  });
  $('#zoomSlider').addEventListener('input', (e) => {
    state.zoom = parseFloat(e.target.value);
    $('#zoomVal').textContent = state.zoom.toFixed(1);
    applyVideoTransform();
  });
  $('#retryBtn').addEventListener('click', () => {
    $('#errorBox').classList.add('hidden');
    startCamera();
  });

  // Tap on video area to dismiss settings
  $('#video').addEventListener('click', () => {
    $('#settingsPanel').classList.add('hidden');
  });

  setupPinchZoom();

  // Playback
  $('#closePlayback').addEventListener('click', closePlayback);
  $('#loopBtn').addEventListener('click', () => {
    state.loop = !state.loop;
    $('#playVideo').loop = state.loop;
    $('#loopBtn').classList.toggle('active', state.loop);
  });
  $('#scrub').addEventListener('input', (e) => {
    const v = $('#playVideo');
    if (v.duration && isFinite(v.duration)) {
      v.pause();
      v.currentTime = (parseFloat(e.target.value) / 1000) * v.duration;
    }
  });
  $('#prevFrame').addEventListener('click', () => stepFrame(-1));
  $('#nextFrame').addEventListener('click', () => stepFrame(1));
  $('#playPauseBtn').addEventListener('click', togglePlayPause);
  $('#saveBtn').addEventListener('click', savePlaybackFrame);
  $('#backToMirror').addEventListener('click', closePlayback);

  const pv = $('#playVideo');
  pv.addEventListener('timeupdate', () => {
    if (pv.duration && isFinite(pv.duration)) {
      $('#scrub').value = (pv.currentTime / pv.duration) * 1000;
    }
  });
  pv.addEventListener('play', () => $('#playPauseBtn').textContent = '⏸');
  pv.addEventListener('pause', () => $('#playPauseBtn').textContent = '▶');
  pv.addEventListener('loadedmetadata', () => { $('#scrub').value = 0; });

  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.view === 'mirror') {
      requestWakeLock();
      if (!state.stream) startCamera();
    }
  });
}

// ============================================================
// View management
// ============================================================
function showView(name) {
  state.view = name;
  $$('.screen').forEach((s) => s.classList.add('hidden'));
  $('#' + name).classList.remove('hidden');
  $('#settingsPanel').classList.add('hidden');

  if (name === 'mirror') {
    startCamera();
    requestWakeLock();
  } else if (name === 'welcome') {
    stopCamera();
    releaseWakeLock();
  }
}

// ============================================================
// Camera
// ============================================================
async function startCamera() {
  if (state.stream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('このブラウザはカメラに対応していません。');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    state.stream = stream;
    const v = $('#video');
    v.srcObject = stream;
    await v.play().catch(() => {});
    applyVideoTransform();
    $('#errorBox').classList.add('hidden');
  } catch (err) {
    showError(getErrorMessage(err));
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  $('#video').srcObject = null;
}

async function switchCamera() {
  state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
  state.mirrored = state.facingMode === 'user';
  stopCamera();
  await startCamera();
  $('#settingsPanel').classList.add('hidden');
}

function getErrorMessage(err) {
  if (!err) return 'カメラの起動に失敗しました。';
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'カメラの利用が許可されていません。\nブラウザの設定からカメラを許可してください。';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'カメラが見つかりません。';
  }
  if (err.name === 'NotReadableError') {
    return '他のアプリがカメラを使用中です。';
  }
  return `カメラの起動に失敗しました: ${err.message || err.name}`;
}

function showError(msg) {
  $('#errorMsg').textContent = msg;
  $('#errorBox').classList.remove('hidden');
}

// ============================================================
// Video transform (mirror / zoom)
// ============================================================
function applyVideoTransform() {
  const v = $('#video');
  const flip = state.mirrored ? -1 : 1;
  v.style.transform = `scaleX(${flip}) scale(${state.zoom})`;
}

function toggleMirrorFlip() {
  state.mirrored = !state.mirrored;
  applyVideoTransform();
  $('#mirrorBtn').classList.toggle('active', !state.mirrored);
  showToast(state.mirrored ? '鏡像表示' : '通常表示（他人視点）');
}

// ============================================================
// Brightness boost
// ============================================================
function toggleBrightness() {
  state.brightnessOn = !state.brightnessOn;
  $('#brightnessFrame').classList.toggle('hidden', !state.brightnessOn);
  $('#brightBtn').classList.toggle('active', state.brightnessOn);
  if (state.brightnessOn) showToast('画面の明るさも最大にすると効果的です');
}

// ============================================================
// Grid
// ============================================================
function toggleGrid() {
  state.gridOn = !state.gridOn;
  $('#grid').classList.toggle('hidden', !state.gridOn);
  $('#gridBtn').classList.toggle('active', state.gridOn);
}

// ============================================================
// Freeze
// ============================================================
function toggleFreeze() {
  const v = $('#video');
  const c = $('#freezeCanvas');
  if (!state.frozen) {
    if (!v.videoWidth) { showToast('カメラ準備中です'); return; }
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0);
    c.style.transform = v.style.transform;
    c.classList.remove('hidden');
    state.frozen = true;
  } else {
    c.classList.add('hidden');
    state.frozen = false;
  }
  $('#freezeBtn').classList.toggle('active', state.frozen);
}

// ============================================================
// Recording
// ============================================================
function getMimeType() {
  const types = [
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function startRecording() {
  if (!state.stream) { showToast('カメラが起動していません'); return; }
  if (state.frozen) toggleFreeze();
  if (typeof MediaRecorder === 'undefined') {
    showToast('録画はこの端末で対応していません');
    return;
  }

  const mime = getMimeType();
  state.recordedMime = mime || 'video/webm';
  try {
    state.recorder = new MediaRecorder(
      state.stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined
    );
  } catch (e) {
    showToast('録画初期化に失敗しました');
    return;
  }

  state.recordedChunks = [];
  state.recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
  };
  state.recorder.onstop = () => {
    const type = state.recorder.mimeType || state.recordedMime;
    const blob = new Blob(state.recordedChunks, { type });
    if (state.recordedUrl) URL.revokeObjectURL(state.recordedUrl);
    state.recordedUrl = URL.createObjectURL(blob);
    showPlayback(state.recordedUrl);
  };

  try { state.recorder.start(50); } catch (e) {
    showToast('録画開始に失敗しました');
    return;
  }
  state.recording = true;
  state.recordStart = Date.now();
  $('#recordBtn').classList.add('recording');
  if (navigator.vibrate) navigator.vibrate(15);
  animateRecordProgress();
  state.recordTimer = setTimeout(stopRecording, state.duration * 1000);
}

function stopRecording() {
  if (!state.recording) return;
  clearTimeout(state.recordTimer);
  state.recording = false;
  $('#recordBtn').classList.remove('recording');
  if (state.recorder && state.recorder.state !== 'inactive') {
    try { state.recorder.stop(); } catch (e) {}
  }
  if (navigator.vibrate) navigator.vibrate(15);
}

function animateRecordProgress() {
  const circle = document.querySelector('.record-progress circle');
  const r = 46;
  const circ = 2 * Math.PI * r;
  circle.style.strokeDasharray = circ;
  circle.style.strokeDashoffset = circ;
  const tick = () => {
    if (!state.recording) {
      circle.style.strokeDashoffset = circ;
      return;
    }
    const elapsed = (Date.now() - state.recordStart) / 1000;
    const progress = Math.min(elapsed / state.duration, 1);
    circle.style.strokeDashoffset = circ * (1 - progress);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ============================================================
// Playback
// ============================================================
function showPlayback(url) {
  showView('playback');
  stopCamera();
  releaseWakeLock();
  const v = $('#playVideo');
  v.src = url;
  v.muted = true;
  v.loop = state.loop;
  v.style.transform = state.mirrored ? 'scaleX(-1)' : '';
  v.load();
  v.addEventListener('loadeddata', () => {
    v.currentTime = 0;
    v.play().catch(() => {});
  }, { once: true });
}

function closePlayback() {
  $('#playVideo').pause();
  showView('mirror');
}

function togglePlayPause() {
  const v = $('#playVideo');
  if (v.paused) v.play().catch(() => {});
  else v.pause();
}

function stepFrame(dir) {
  const v = $('#playVideo');
  v.pause();
  const step = 1 / 30;
  const dur = isFinite(v.duration) ? v.duration : 0;
  v.currentTime = Math.max(0, Math.min(dur, v.currentTime + dir * step));
}

async function savePlaybackFrame() {
  const v = $('#playVideo');
  if (!v.videoWidth) { showToast('動画の準備中です'); return; }
  v.pause();
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  const ctx = c.getContext('2d');
  if (state.mirrored) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, 0, 0);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  if (!blob) { showToast('保存に失敗しました'); return; }
  await saveImage(blob, `mirror360-${tsName()}.png`);
}

async function captureLiveStill() {
  const v = $('#video');
  if (!v.videoWidth) { showToast('カメラの準備中です'); return; }
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  const ctx = c.getContext('2d');
  if (state.mirrored) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, 0, 0);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  if (!blob) { showToast('保存に失敗しました'); return; }
  await saveImage(blob, `mirror360-${tsName()}.png`);
  if (navigator.vibrate) navigator.vibrate(15);
}

async function saveImage(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      showToast('保存しました');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  downloadBlob(blob, filename);
  showToast('保存しました');
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

function tsName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ============================================================
// Wake Lock
// ============================================================
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (state.wakeLock) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch (e) {}
}

function releaseWakeLock() {
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }
}

// ============================================================
// Pinch zoom
// ============================================================
function setupPinchZoom() {
  const target = $('#mirror');
  let startDist = 0;
  let startZoom = 1;

  target.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      startDist = touchDist(e.touches);
      startZoom = state.zoom;
    }
  }, { passive: true });

  target.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && startDist > 0) {
      const d = touchDist(e.touches);
      const z = clamp(startZoom * (d / startDist), 1, 3);
      state.zoom = z;
      $('#zoomSlider').value = z;
      $('#zoomVal').textContent = z.toFixed(1);
      applyVideoTransform();
    }
  }, { passive: true });

  target.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) startDist = 0;
  }, { passive: true });
}

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// ============================================================
// Toast
// ============================================================
let toastTimer;
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

init();
