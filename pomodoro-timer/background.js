const DEFAULT_SETTINGS = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  soundVolume: 70, // 0〜100
  // 音の種類は sound.js の SOUND_TYPES のキー
  workEndSound: 'chime', // 作業が終わったとき
  breakEndSound: 'bell', // 休憩（短い・長い）が終わったとき
  autoStartNext: false, // フェーズ終了後に次のフェーズを自動で開始する
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
  const stored = { ...s.settings };
  // 旧バージョン（音が1種類だけ）の設定から移行する。選んでいた音は作業終了の音として引き継ぐ
  if (stored.soundType && !stored.workEndSound) stored.workEndSound = stored.soundType;
  delete stored.soundType;
  s.settings = { ...DEFAULT_SETTINGS, ...stored };
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

// 通知 ID はフェーズ終了ごとに変える。同じ ID を使い回すと、前の通知
// （requireInteraction で残っているもの）が書き換わるだけで、新しい通知として表示されないことがある。
const NOTIFICATION_PREFIX = 'phaseEnd-';

async function clearPhaseNotifications() {
  const all = await chrome.notifications.getAll();
  await Promise.all(
    Object.keys(all)
      .filter((id) => id.startsWith(NOTIFICATION_PREFIX))
      .map((id) => chrome.notifications.clear(id))
  );
}

async function startTimer(state) {
  await clearPhaseNotifications();
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
  const autoStart = state.settings.autoStartNext;
  if (autoStart) {
    await startTimer(state);
  } else {
    await clearPhaseNotifications();
    await setState(state);
  }

  if (state.settings.soundEnabled) {
    const soundType = finished === 'work' ? state.settings.workEndSound : state.settings.breakEndSound;
    playSound(soundType, state.settings.soundVolume).catch((e) => console.warn('通知音を再生できませんでした', e));
  }

  const title =
    finished === 'work' ? `作業が終わりました（今日 ${state.todayCount} 回目）` : '休憩が終わりました';
  const id = NOTIFICATION_PREFIX + Date.now();
  if (autoStart) {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/128.png',
      title,
      message: `「${PHASE_LABEL[state.phase]}」を開始しました。`,
      priority: 2,
    });
  } else {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/128.png',
      title,
      message: `次は「${PHASE_LABEL[state.phase]}」です。`,
      buttons: [{ title: `${PHASE_LABEL[state.phase]}を開始` }],
      requireInteraction: true,
      priority: 2,
    });
  }
}

// service worker は音を出せないので、offscreen ドキュメントで再生する
let creatingOffscreen = null;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'フェーズ終了時に通知音を鳴らすため',
      })
      .finally(() => (creatingOffscreen = null));
  }
  await creatingOffscreen;
}

async function playSound(soundType, volume) {
  await ensureOffscreen();
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'play',
    soundType,
    volume,
  });
}

// 状態の読み書きを1つずつ順番に行う。phaseEnd と tick のアラームが同時に来たときなどに、
// 古い状態をもとに二重に処理しないようにする。
let queue = Promise.resolve();
function serialized(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
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

    // ---- デバッグ用（一時的な機能。不要になったら popup の debug セクションごと削除する） ----
    case 'debugSetRemaining': {
      const ms = Math.max(0, payload.seconds) * 1000;
      if (state.status === 'paused') {
        state.remainingMs = ms;
        await setState(state);
      } else {
        if (state.status !== 'running') await startTimer(state);
        state.endTime = Date.now() + ms;
        await chrome.alarms.create('phaseEnd', { when: state.endTime });
        await setState(state);
      }
      break;
    }
    case 'debugFinishNow':
      if (state.status !== 'running') await startTimer(state);
      await finishPhase();
      break;
    case 'debugResetCycle':
      state.completedInCycle = 0;
      state.todayCount = 0;
      await setState(state);
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
  if (msg.target === 'offscreen') return false;
  serialized(() => handleCommand(msg.type, msg.payload))
    .then(() => sendResponse({ ok: true }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) =>
  serialized(async () => {
    const state = await getState();
    if (state.status !== 'running') return;
    // phaseEnd が来たとき、または phaseEnd が遅れて tick で終了時刻を過ぎていたら終了する。
    // デバッグで終了時刻を変えた直後の古い phaseEnd は、時刻をまだ過ぎていないので無視される。
    if (Date.now() >= state.endTime - 500) await finishPhase();
    else await updateBadge(state);
  })
);

function startFromNotification(id) {
  if (!id.startsWith(NOTIFICATION_PREFIX)) return;
  chrome.notifications.clear(id);
  serialized(() => handleCommand('start'));
}

chrome.notifications.onButtonClicked.addListener(startFromNotification);
chrome.notifications.onClicked.addListener(startFromNotification);

const restore = () => serialized(async () => {
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
});

chrome.runtime.onStartup.addListener(restore);
chrome.runtime.onInstalled.addListener(restore);
