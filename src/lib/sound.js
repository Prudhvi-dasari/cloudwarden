/**
 * Web Audio API Sound Synthesizer
 * Generates rich, crisp, studio-quality UI chime sounds natively for 1-2 seconds.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('itransfer_sound_enabled') !== 'false';
}

export function setSoundEnabled(enabled) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('itransfer_sound_enabled', enabled ? 'true' : 'false');
}

/**
 * Play a rich, crystal-clear 1.8-second celebratory completion chime
 * Uses a 4-note ascending chord progression (C5 -> E5 -> G5 -> C6) with lingering acoustic decay.
 */
export function playSuccessChime() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Ensure audio context is active
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz), E6 (1318.51Hz)
    const notes = [
      { freq: 523.25, time: 0.00, dur: 1.6, gain: 0.22 },
      { freq: 659.25, time: 0.08, dur: 1.5, gain: 0.25 },
      { freq: 783.99, time: 0.16, dur: 1.5, gain: 0.28 },
      { freq: 1046.50, time: 0.24, dur: 1.6, gain: 0.30 },
      { freq: 1318.51, time: 0.32, dur: 1.4, gain: 0.20 }, // Harmonic sparkle
    ];

    notes.forEach(({ freq, time, dur, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Sine wave with subtle harmonics for a warm marimba/bell timbre
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      gainNode.gain.setValueAtTime(0, now + time);
      // Fast attack
      gainNode.gain.linearRampToValueAtTime(gain, now + time + 0.03);
      // Gentle exponential decay over 1.5-1.8 seconds
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });

  } catch (e) {
    console.warn('Audio play notice:', e);
  }
}

/**
 * Play a soft download complete chime
 */
export function playDownloadChime() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {}
}

/**
 * Soft error / alert tone
 */
export function playErrorSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(160, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
}
