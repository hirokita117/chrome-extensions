// フェーズ終了時に background から呼ばれて音を鳴らす
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== 'offscreen' || msg.type !== 'play') return;
  playSound(msg.soundType, msg.volume);
});
