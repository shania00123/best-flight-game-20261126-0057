// Procedural cockpit audio with WebAudio: engine hum, wind rush, ring
// chimes, a stall beeper and landing thuds. No audio files, so the game
// stays fully offline; everything is silent until the first key press.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;
  let stallTimer = 0;

  function ensureContext() {
    if (context || typeof window === 'undefined') return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    context = new AudioCtor();
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOsc.start();
    const noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const wind = context.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windGain = context.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    wind.start();
  }

  function blip(frequency, seconds, gainValue, type) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + seconds);
  }

  return {
    unlock() {
      ensureContext();
      if (context && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      if (muted && engineGain) engineGain.gain.value = 0;
      if (muted && windGain) windGain.gain.value = 0;
      return muted;
    },
    update(state, dt) {
      if (!context || muted) return;
      const engineLevel = state.engineOut ? 0 : 0.02 + state.throttle * 0.05;
      engineGain.gain.value += (engineLevel - engineGain.gain.value) * Math.min(1, dt * 6);
      engineOsc.frequency.value = 55 + state.throttle * 85 + state.speed * 0.35;
      const windLevel = Math.min(0.06, state.speed * 0.0006);
      windGain.gain.value += (windLevel - windGain.gain.value) * Math.min(1, dt * 4);
      stallTimer -= dt;
      if (state.stalled && !state.onGround && stallTimer <= 0) {
        blip(880, 0.12, 0.05, 'square');
        stallTimer = 0.45;
      }
    },
    ring() {
      blip(784, 0.16, 0.07, 'sine');
      blip(1175, 0.22, 0.05, 'sine');
    },
    photo() {
      blip(1319, 0.1, 0.06, 'triangle');
    },
    touchdown(hard) {
      blip(hard ? 70 : 110, 0.25, hard ? 0.12 : 0.06, 'sine');
    },
    crash() {
      blip(55, 0.6, 0.14, 'sawtooth');
    },
  };
}
