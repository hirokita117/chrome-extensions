// Web Audio で通知音を合成する。音声ファイルは使わない。
// popup（試聴）と offscreen（フェーズ終了時）の両方から読み込む。

const SOUND_TYPES = {
  chime: 'チャイム',
  bell: 'ベル',
  beep: 'ビープ',
  soft: 'やわらかい音',
};

let audioCtx = null;

function tone(ctx, out, { freq, start, duration, type = 'sine', gain = 1 }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

const PATTERNS = {
  chime: (ctx, out) => {
    [523.25, 659.25, 783.99].forEach((freq, i) =>
      tone(ctx, out, { freq, start: i * 0.18, duration: 0.9 })
    );
  },
  bell: (ctx, out) => {
    for (const start of [0, 0.9]) {
      tone(ctx, out, { freq: 880, start, duration: 1.4 });
      tone(ctx, out, { freq: 1760, start, duration: 0.8, gain: 0.4 });
      tone(ctx, out, { freq: 2640, start, duration: 0.4, gain: 0.2 });
    }
  },
  beep: (ctx, out) => {
    [0, 0.25, 0.5].forEach((start) =>
      tone(ctx, out, { freq: 1000, start, duration: 0.15, type: 'square', gain: 0.35 })
    );
  },
  soft: (ctx, out) => {
    tone(ctx, out, { freq: 392, start: 0, duration: 1.2, type: 'triangle' });
    tone(ctx, out, { freq: 523.25, start: 0.4, duration: 1.6, type: 'triangle' });
  },
};

// volume: 0〜100
async function playSound(type, volume) {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  const master = audioCtx.createGain();
  master.gain.value = Math.max(0, Math.min(100, volume)) / 100;
  master.connect(audioCtx.destination);
  (PATTERNS[type] || PATTERNS.chime)(audioCtx, master);
}
