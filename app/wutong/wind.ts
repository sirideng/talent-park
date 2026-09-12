import {audioOutput,releaseAudio} from '../shared/preferences';
export class MountainWind {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  get state() {
    return { active: !!this.source, context: this.context?.state ?? 'none' };
  }
  start() {
    try {
      const c = (this.context ??= new AudioContext());
      void c.resume().catch(() => this.stop());
      if (this.source) return;
      const b = c.createBuffer(1, c.sampleRate * 6, c.sampleRate),
        v = b.getChannelData(0);
      let seed = 41,
        last = 0;
      for (let i = 0; i < v.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        last = (last + (seed / 2147483648 - 1) * 0.04) / 1.04;
        v[i] =
          last * (0.6 + 0.2 * Math.cos(((i / c.sampleRate) * Math.PI) / 3));
      }
      const source = c.createBufferSource(),
        gain = c.createGain();
      source.buffer = b;
      source.loop = true;
      gain.gain.value = 0.11;
      source.connect(gain);
      gain.connect(audioOutput(c));
      source.start();
      this.source = source;
      this.gain = gain;
    } catch {
      this.stop();
    }
  }
  stop() {
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    this.gain?.disconnect();
    this.gain = null;
    if (this.context?.state === 'running')
      void this.context.suspend().catch(() => {});
  }
  dispose() {
    if(this.context)releaseAudio(this.context);
    this.stop();
    if (this.context && this.context.state !== 'closed')
      void this.context.close().catch(() => {});
  }
}
