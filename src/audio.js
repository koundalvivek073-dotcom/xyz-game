// High-fidelity procedural audio engine using Web Audio API

let audioCtx = null;
let soundEnabled = true;
let windNode = null;
let masterGain = null;

export function initAudio() {
  if (audioCtx) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.85, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
  } catch (e) {
    console.warn('Web Audio not supported:', e);
  }
}

export function setAudioEnabled(enabled) {
  soundEnabled = enabled;
  if (!soundEnabled && windNode) {
    stopAmbience();
  } else if (soundEnabled && !windNode && audioCtx) {
    startAmbience();
  }
}

export function resumeAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function ensureCtx() {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return soundEnabled && audioCtx;
}

// Heavy Punchy Gunshot (Assault Rifle)
export function playShoot(isUpgraded = false) {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;

  // 1. High explosive crack (White/Pink noise burst)
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.22);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.18));
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = isUpgraded ? 'bandpass' : 'lowpass';
  noiseFilter.frequency.setValueAtTime(isUpgraded ? 2800 : 1800, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(220, now + 0.18);

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(isUpgraded ? 1.0 : 0.85, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noise.start(now);

  // 2. Heavy Sub-Bass Kick (Chest-thump punch)
  const subKick = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  subKick.type = 'triangle';
  subKick.frequency.setValueAtTime(isUpgraded ? 210 : 160, now);
  subKick.frequency.exponentialRampToValueAtTime(32, now + 0.15);

  subGain.gain.setValueAtTime(isUpgraded ? 0.95 : 0.8, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  subKick.connect(subGain);
  subGain.connect(masterGain);
  subKick.start(now);
  subKick.stop(now + 0.17);

  // 3. Metallic bolt click
  const bolt = audioCtx.createOscillator();
  const boltGain = audioCtx.createGain();
  bolt.type = 'square';
  bolt.frequency.setValueAtTime(950, now);
  boltGain.gain.setValueAtTime(0.18, now);
  boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  bolt.connect(boltGain);
  boltGain.connect(masterGain);
  bolt.start(now);
  bolt.stop(now + 0.04);
}

// Crisp Hitmarker tick
export function playHitmarker() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2400, now);
  osc.frequency.setValueAtTime(2900, now + 0.02);

  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.07);
}

// Headshot metallic dink (satisfying high chime)
export function playHeadshot() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(3600, now);
  osc.frequency.exponentialRampToValueAtTime(2200, now + 0.22);

  gain.gain.setValueAtTime(0.65, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.26);
}

// Crunchy Elimination Skull sound (Apex/Warzone style reward!)
export function playElimination() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;

  // Deep crunch chime
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(580, now);
  osc1.frequency.exponentialRampToValueAtTime(140, now + 0.3);
  gain1.gain.setValueAtTime(0.55, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.33);

  // High metallic sting
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1200, now + 0.05);
  gain2.gain.setValueAtTime(0.4, now + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.05);
  osc2.stop(now + 0.26);
}

// Damage impact on player
export function playDamage() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);

  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.25);
}

// Footstep
export function playFootstep() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.05);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(450, now);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(now);
}

// Jump whoosh
export function playJump() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.16);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.17);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.17);
}

// Land thud
export function playLand() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.19);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.19);
}

// Reload click-clack
export function playReload() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;

  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(750, now);
  gain1.gain.setValueAtTime(0.28, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.07);

  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1250, now + 0.24);
  gain2.gain.setValueAtTime(0.35, now + 0.24);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.24);
  osc2.stop(now + 0.36);
}

// Healing sound
export function playHeal() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(340, now);
  osc.frequency.exponentialRampToValueAtTime(720, now + 0.38);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.43);
}

// Crate pickup
export function playCratePickup() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.07);
    gain.gain.setValueAtTime(0.3, now + i * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now + i * 0.07);
    osc.stop(now + i * 0.07 + 0.19);
  });
}

// Victory Fanfare
export function playVictory() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const notes = [440, 554.37, 659.25, 880, 1108.7];
  notes.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.15);
    gain.gain.setValueAtTime(0.45, now + idx * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.15 + 0.8);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now + idx * 0.15);
    osc.stop(now + idx * 0.15 + 0.85);
  });
}

// Defeat rumble
export function playDefeat() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 1.4);

  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 1.55);
}

// UI Click
export function playUIClick() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, now);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.04);
}

// Ambient desert wind
export function startAmbience() {
  if (!ensureCtx() || windNode) return;
  try {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, audioCtx.currentTime);
    filter.Q.setValueAtTime(1.8, audioCtx.currentTime);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
    windNode = { noise, gain };
  } catch (e) {
    console.warn('Failed to start ambience:', e);
  }
}

export function stopAmbience() {
  if (windNode) {
    try {
      windNode.noise.stop();
    } catch (_) {}
    windNode = null;
  }
}

// Crisp metallic brass shell casing drop / bounce on dirt & rock
export function playShellDrop() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;
  const baseFreq = 2600 + Math.random() * 800;

  // Tiny metallic resonant ping
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.045);

  gain.gain.setValueAtTime(0.14 + Math.random() * 0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.055);
}

// Tactical scope zoom / optic mode switch click
export function playScopeSwitch() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.setValueAtTime(2400, now + 0.03);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.085);
}

// Empty weapon dry-fire click
export function playEmptyClick() {
  if (!ensureCtx()) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(680, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.055);
}

