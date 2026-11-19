// ---- デバッグ用（一時的な機能） ----
// 残り時間を書き換えたり、今のフェーズをすぐ終わらせたりして、フェーズの切り替えを確認する。
// 不要になったら、このファイルと popup.html の <script src="debug.js"> を削除し、
// background.js の debug* コマンドも消す。
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .debug { margin-top: 10px; border: 1px dashed #f59e0b; border-radius: 4px; padding: 6px 8px; background: #fffbeb; }
    .debug summary { color: #b45309; font-weight: 600; }
    .debug .row { display: flex; gap: 4px; margin-top: 6px; align-items: center; }
    .debug button { flex: 1; padding: 4px; font-size: 11px; font-weight: 500; background: #f59e0b; }
    .debug input { width: 56px; padding: 3px 4px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; }
    .debug pre { margin: 6px 0 0; font-size: 10px; white-space: pre-wrap; color: #555; max-height: 140px; overflow: auto; }
  `;
  document.head.append(style);

  const box = document.createElement('details');
  box.className = 'debug';
  box.innerHTML = `
    <summary>デバッグ（一時的）</summary>
    <div class="row">
      残り <input type="number" id="debug-seconds" min="0" value="10"> 秒に
      <button id="debug-set">する</button>
    </div>
    <div class="row">
      <button data-sec="5">残り5秒</button>
      <button data-sec="30">残り30秒</button>
      <button id="debug-finish">今すぐ終了</button>
    </div>
    <div class="row">
      <button id="debug-reset-cycle">作業回数と今日の回数を0に</button>
    </div>
    <pre id="debug-state"></pre>
  `;
  document.body.append(box);

  const send = (type, payload) => chrome.runtime.sendMessage({ type, payload });
  const setRemaining = (seconds) => send('debugSetRemaining', { seconds });

  box.querySelector('#debug-set').addEventListener('click', () =>
    setRemaining(Number(box.querySelector('#debug-seconds').value) || 0)
  );
  box.querySelectorAll('[data-sec]').forEach((b) =>
    b.addEventListener('click', () => setRemaining(Number(b.dataset.sec)))
  );
  box.querySelector('#debug-finish').addEventListener('click', () => send('debugFinishNow'));
  box.querySelector('#debug-reset-cycle').addEventListener('click', () => send('debugResetCycle'));

  // 状態とアラームを表示する
  async function dump() {
    if (!box.open) return;
    const { state } = await chrome.storage.local.get('state');
    const alarms = await chrome.alarms.getAll();
    const fmt = (t) => (t ? new Date(t).toLocaleTimeString() : '-');
    box.querySelector('#debug-state').textContent = [
      `phase=${state?.phase} status=${state?.status}`,
      `completedInCycle=${state?.completedInCycle} todayCount=${state?.todayCount}`,
      `endTime=${fmt(state?.endTime)} remainingMs=${state?.remainingMs}`,
      `autoStartNext=${state?.settings?.autoStartNext}`,
      `sound=${state?.settings?.soundEnabled} work=${state?.settings?.workEndSound} break=${state?.settings?.breakEndSound} vol=${state?.settings?.soundVolume}`,
      ...alarms.map((a) => `alarm ${a.name}: ${fmt(a.scheduledTime)}`),
    ].join('\n');
  }
  box.addEventListener('toggle', dump);
  setInterval(dump, 1000);
})();
