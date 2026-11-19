const PHASE_LABEL = {
  work: '作業',
  shortBreak: '短い休憩',
  longBreak: '長い休憩',
};
const STATUS_LABEL = { idle: '・待機中', running: '', paused: '・一時停止中' };
const SETTING_KEYS = ['workMin', 'shortBreakMin', 'longBreakMin', 'longBreakInterval'];

const isWidget = new URLSearchParams(location.search).get('mode') === 'widget';
if (isWidget) document.body.classList.add('widget');

const $ = (id) => document.getElementById(id);
let state = null;
let pip = null; // { window, time, phase, toggle }

function send(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}

function remainingMs(s) {
  if (s.status === 'running') return Math.max(0, s.endTime - Date.now());
  if (s.status === 'paused') return s.remainingMs;
  const min = {
    work: s.settings.workMin,
    shortBreak: s.settings.shortBreakMin,
    longBreak: s.settings.longBreakMin,
  }[s.phase];
  return min * 60 * 1000;
}

function format(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function toggleLabel(s) {
  if (s.status === 'running') return '一時停止';
  if (s.status === 'paused') return '再開';
  return '開始';
}

function render() {
  if (!state) return;
  const time = format(remainingMs(state));
  const isBreak = state.phase !== 'work';
  document.body.classList.toggle('phase-break', isBreak);
  $('phase-label').textContent = PHASE_LABEL[state.phase];
  $('status-label').textContent = STATUS_LABEL[state.status];
  $('time').textContent = time;
  $('toggle').textContent = toggleLabel(state);
  $('today-count').textContent = state.todayCount;
  document.title = `${time} ${PHASE_LABEL[state.phase]} - Pomodoro`;

  if (pip) {
    pip.window.document.body.classList.toggle('phase-break', isBreak);
    pip.phase.textContent = PHASE_LABEL[state.phase] + STATUS_LABEL[state.status];
    pip.time.textContent = time;
    pip.toggle.textContent = toggleLabel(state);
  }
}

function fillSettings() {
  for (const key of SETTING_KEYS) $(key).value = state.settings[key];
}

async function load() {
  const res = await chrome.storage.local.get('state');
  if (!res.state) {
    // 初回はバックグラウンドに初期状態を作らせる
    await send('saveSettings', {});
    return load();
  }
  state = res.state;
  fillSettings();
  render();
}

function onToggle() {
  if (!state) return;
  send(state.status === 'running' ? 'pause' : 'start');
}

$('toggle').addEventListener('click', onToggle);
$('reset').addEventListener('click', () => send('reset'));
$('skip').addEventListener('click', () => send('skip'));
$('open-widget').addEventListener('click', async () => {
  await send('openWidget');
  window.close();
});

$('save-settings').addEventListener('click', () => {
  const payload = {};
  for (const key of SETTING_KEYS) {
    const v = parseInt($(key).value, 10);
    if (!Number.isFinite(v) || v < 1) {
      $(key).focus();
      return;
    }
    payload[key] = v;
  }
  send('saveSettings', payload);
  $('save-settings').textContent = '保存しました';
  setTimeout(() => ($('save-settings').textContent = '保存'), 1200);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.state) {
    const settingsChanged =
      JSON.stringify(changes.state.newValue?.settings) !== JSON.stringify(state?.settings);
    state = changes.state.newValue;
    if (settingsChanged) fillSettings();
    render();
  }
});

// 最前面のミニ表示（Document Picture-in-Picture）
const PIP_STYLE = `
  body {
    margin: 0; height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 4px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #fff; color: #111; --accent: #dc2626;
  }
  body.phase-break { --accent: #16a34a; }
  .phase { color: var(--accent); font-weight: 600; font-size: 12px; }
  .time { font-size: 36px; font-weight: 700; font-variant-numeric: tabular-nums; }
  button {
    padding: 4px 14px; background: var(--accent); color: #fff; border: none;
    border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
`;

$('open-pip').addEventListener('click', async () => {
  if (pip) {
    pip.window.focus();
    return;
  }
  if (!('documentPictureInPicture' in window)) {
    alert('このバージョンの Chrome は最前面表示（Document Picture-in-Picture）に対応していません。');
    return;
  }
  const pipWindow = await documentPictureInPicture.requestWindow({ width: 200, height: 120 });
  const doc = pipWindow.document;
  const style = doc.createElement('style');
  style.textContent = PIP_STYLE;
  doc.head.append(style);
  const phase = doc.createElement('div');
  phase.className = 'phase';
  const time = doc.createElement('div');
  time.className = 'time';
  const toggle = doc.createElement('button');
  toggle.addEventListener('click', onToggle);
  doc.body.append(phase, time, toggle);
  pip = { window: pipWindow, phase, time, toggle };
  pipWindow.addEventListener('pagehide', () => (pip = null));
  render();
});

setInterval(render, 250);
load();
