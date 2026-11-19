const DEFAULT_SETTINGS = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakInterval: 4,
};

const PHASE_LABEL = {
  work: '作業',
  shortBreak: '短い休憩',
  longBreak: '長い休憩',
};

const WIDGET_DEFAULT = { width: 300, height: 360 };

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function defaultState() {
  return {
    phase: 'work',
    status: 'idle', // idle | running | paused
    endTime: null,
    remainingMs: null,
    completedInCycle: 0,
    todayCount: 0,
    todayDate: todayString(),
    settings: { ...DEFAULT_SETTINGS },
  };
}

function phaseDurationMs(phase, settings) {
  const min = {
    work: settings.workMin,
    shortBreak: settings.shortBreakMin,
    longBreak: settings.longBreakMin,
  }[phase];
  return min * 60 * 1000;
}

async function getState() {
  const { state } = await chrome.storage.local.get('state');
  const s = state ? { ...defaultState(), ...state } : defaultState();
  s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
  if (s.todayDate !== todayString()) {
    s.todayDate = todayString();
    s.todayCount = 0;
  }
  return s;
}

async function setState(state) {
  await chrome.storage.local.set({ state });
  await updateBadge(state);
}

function remainingMs(state) {
  if (state.status === 'running') return Math.max(0, state.endTime - Date.now());
  if (state.status === 'paused') return state.remainingMs;
  return phaseDurationMs(state.phase, state.settings);
}

async function updateBadge(state) {
  if (state.status === 'idle') {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const min = Math.ceil(remainingMs(state) / 60000);
  const color =
    state.status === 'paused' ? '#6b7280' : state.phase === 'work' ? '#dc2626' : '#16a34a';
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text: String(min) });
}

async function startTimer(state) {
  const ms = state.status === 'paused' ? state.remainingMs : phaseDurationMs(state.phase, state.settings);
  state.status = 'running';
  state.endTime = Date.now() + ms;
  state.remainingMs = null;
  await chrome.alarms.create('phaseEnd', { when: state.endTime });
  await chrome.alarms.create('tick', { periodInMinutes: 0.5 });
  await setState(state);
}

async function clearAlarms() {
  await chrome.alarms.clear('phaseEnd');
  await chrome.alarms.clear('tick');
}

function nextPhase(state) {
  if (state.phase !== 'work') return 'work';
  return state.completedInCycle >= state.settings.longBreakInterval ? 'longBreak' : 'shortBreak';
}

async function finishPhase() {
  const state = await getState();
  if (state.status !== 'running') return;
  await clearAlarms();
  const finished = state.phase;
  if (finished === 'work') {
    state.todayCount += 1;
    state.completedInCycle += 1;
  }
  state.phase = nextPhase(state);
  if (state.phase === 'longBreak') state.completedInCycle = 0;
  state.status = 'idle';
  state.endTime = null;
  state.remainingMs = null;
  await setState(state);

  const title =
    finished === 'work' ? `作業が終わりました（今日 ${state.todayCount} 回目）` : '休憩が終わりました';
  chrome.notifications.create('phaseEnd', {
    type: 'basic',
    iconUrl: 'icons/128.png',
    title,
    message: `次は「${PHASE_LABEL[state.phase]}」です。`,
    buttons: [{ title: `${PHASE_LABEL[state.phase]}を開始` }],
    requireInteraction: true,
    priority: 2,
  });
}

async function handleCommand(type, payload) {
  const state = await getState();
  switch (type) {
    case 'start':
      if (state.status !== 'running') await startTimer(state);
      break;
    case 'pause':
      if (state.status === 'running') {
        await clearAlarms();
        state.remainingMs = Math.max(0, state.endTime - Date.now());
        state.endTime = null;
        state.status = 'paused';
        await setState(state);
      }
      break;
    case 'reset':
      await clearAlarms();
      state.status = 'idle';
      state.endTime = null;
      state.remainingMs = null;
      await setState(state);
      break;
    case 'skip':
      await clearAlarms();
      state.phase = nextPhase(state);
      if (state.phase === 'longBreak') state.completedInCycle = 0;
      state.status = 'idle';
      state.endTime = null;
      state.remainingMs = null;
      await setState(state);
      break;
    case 'saveSettings':
      state.settings = { ...state.settings, ...payload };
      await setState(state);
      break;
    case 'openWidget':
      await openWidget();
      break;
  }
}

async function openWidget() {
  const { widgetWindowId, widgetBounds } = await chrome.storage.local.get([
    'widgetWindowId',
    'widgetBounds',
  ]);
  if (widgetWindowId != null) {
    try {
      await chrome.windows.update(widgetWindowId, { focused: true });
      return;
    } catch {
      // ウインドウはもう存在しない
    }
  }
  const bounds = widgetBounds || WIDGET_DEFAULT;
  let win;
  try {
    win = await chrome.windows.create({
      url: 'popup.html?mode=widget',
      type: 'popup',
      focused: true,
      ...bounds,
    });
  } catch {
    // 保存した位置のディスプレイが外れている場合などは既定値で開く
    win = await chrome.windows.create({
      url: 'popup.html?mode=widget',
      type: 'popup',
      focused: true,
      ...WIDGET_DEFAULT,
    });
  }
  await chrome.storage.local.set({ widgetWindowId: win.id });
}

chrome.windows.onBoundsChanged.addListener(async (win) => {
  const { widgetWindowId } = await chrome.storage.local.get('widgetWindowId');
  if (win.id !== widgetWindowId) return;
  const { left, top, width, height } = win;
  await chrome.storage.local.set({ widgetBounds: { left, top, width, height } });
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { widgetWindowId } = await chrome.storage.local.get('widgetWindowId');
  if (windowId === widgetWindowId) await chrome.storage.local.remove('widgetWindowId');
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleCommand(msg.type, msg.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'phaseEnd') {
    await finishPhase();
  } else if (alarm.name === 'tick') {
    const state = await getState();
    // phaseEnd アラームが遅れた場合の保険
    if (state.status === 'running' && Date.now() >= state.endTime) await finishPhase();
    else await updateBadge(state);
  }
});

async function startFromNotification() {
  chrome.notifications.clear('phaseEnd');
  await handleCommand('start');
}

chrome.notifications.onButtonClicked.addListener((id) => {
  if (id === 'phaseEnd') startFromNotification();
});

chrome.notifications.onClicked.addListener((id) => {
  if (id === 'phaseEnd') startFromNotification();
});

async function restore() {
  const state = await getState();
  if (state.status === 'running' && Date.now() >= state.endTime) {
    await finishPhase();
  } else {
    if (state.status === 'running') {
      // 拡張の再読み込みなどでアラームが消えていても張り直す
      await chrome.alarms.create('phaseEnd', { when: state.endTime });
      await chrome.alarms.create('tick', { periodInMinutes: 0.5 });
    }
    await setState(state);
  }
}

chrome.runtime.onStartup.addListener(restore);
chrome.runtime.onInstalled.addListener(restore);
