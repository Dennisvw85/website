// AudioWorklet: verzamelt microfoonaudio in blokjes van 100 ms (24 kHz) voor de avatar-sessie.
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.buffer.push(...channel);
      if (this.buffer.length >= 2400) {
        this.port.postMessage(new Float32Array(this.buffer));
        this.buffer = [];
      }
    }
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
