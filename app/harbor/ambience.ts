/** Quiet original synthesis. No recordings, timers or sounds before a gesture. */
export class HarborAmbience {
  private context: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private disposed = false;
  private failed = false;
  get state() {
    return {
      active: this.sources.length > 0,
      state: this.context?.state ?? 'none',
      failed: this.failed,
    };
  }
  start() {
    if (this.disposed || this.sources.length) return;
    try {
      const c = (this.context ??= new AudioContext());
      void c.resume().catch(() => {
        this.failed = true;
        this.stop();
      });
      const gain = c.createGain();
      gain.gain.value = 0.12;
      gain.connect(c.destination);
      const low = c.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 850;
      low.connect(gain);
      const buffer = c.createBuffer(1, c.sampleRate * 10, c.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 73,
        previous = 0;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        previous = (previous + (seed / 2147483648 - 1) * 0.08) / 1.08;
        data[i] =
          previous *
          (0.45 + 0.3 * Math.cos(((i / c.sampleRate) * Math.PI) / 5));
      }
      const sea = c.createBufferSource();
      sea.buffer = buffer;
      sea.loop = true;
      sea.connect(low);
      const motor = c.createOscillator(),
        motorGain = c.createGain();
      motor.type = 'sine';
      motor.frequency.value = 62;
      motorGain.gain.value = 0.025;
      motor.connect(motorGain);
      motorGain.connect(gain);
      this.nodes = [gain, low, motorGain];
      this.sources = [sea, motor];
      sea.start();
      motor.start();
      this.failed = false;
    } catch {
      this.failed = true;
      this.stop();
    }
  }
  stop() {
    for (const node of this.sources.splice(0)) {
      try {
        node.stop();
      } catch {}
      node.disconnect();
    }
    for (const node of this.nodes.splice(0)) node.disconnect();
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
