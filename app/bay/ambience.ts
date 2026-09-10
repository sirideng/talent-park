/** Original procedural ambience; no third-party recordings, streaming or timers. */
export class BayAmbience {
  private context: AudioContext | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private gain: GainNode | null = null;
  private failed = false;
  private disposed = false;
  get state() {
    return {
      active: this.sources.length > 0,
      state: this.context?.state ?? 'none',
      failed: this.failed,
    };
  }
  start() {
    if (this.disposed) return;
    try {
      const c = (this.context ??= new AudioContext());
      void c.resume().catch(() => {
        this.failed = true;
        this.stop();
      });
      if (this.sources.length) return;
      this.failed = false;
      const master = c.createGain();
      master.gain.value = 0.1;
      master.connect(c.destination);
      this.gain = master;
      const buffer = c.createBuffer(1, c.sampleRate * 8, c.sampleRate),
        data = buffer.getChannelData(0);
      let seed = 45,
        last = 0;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        last = (last + ((seed / 4294967296) * 2 - 1) * 0.07) / 1.07;
        data[i] = last * (0.55 + 0.4 * Math.sin((i / c.sampleRate) * 0.9));
      }
      const noise = c.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const low = c.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 1400;
      noise.connect(low);
      low.connect(master);
      noise.start();
      this.sources.push(noise);
      const birds = c.createBuffer(1, c.sampleRate * 12, c.sampleRate),
        b = birds.getChannelData(0);
      for (let i = 0; i < b.length; i++) {
        const t = i / c.sampleRate,
          phase = t % 3;
        const env = phase < 0.55 ? Math.sin((phase / 0.55) * Math.PI) ** 2 : 0;
        b[i] =
          Math.sin(2 * Math.PI * (1350 * t + 45 * Math.sin(t * 12))) *
          env *
          0.065;
      }
      const chirp = c.createBufferSource();
      chirp.buffer = birds;
      chirp.loop = true;
      chirp.connect(master);
      chirp.start();
      this.sources.push(chirp);
    } catch {
      this.failed = true;
      this.stop();
    }
  }
  stop() {
    for (const s of this.sources.splice(0)) {
      try {
        s.stop();
      } catch {}
      s.disconnect();
    }
    this.gain?.disconnect();
    this.gain = null;
    if (this.context?.state === 'running')
      void this.context.suspend().catch(() => {});
  }
  dispose() {
    this.disposed = true;
    this.stop();
    if (this.context && this.context.state !== 'closed')
      void this.context.close().catch(() => {});
  }
}
