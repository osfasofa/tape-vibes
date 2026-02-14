export class MicInput {
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  async connect(ctx: AudioContext, destination: AudioNode): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.sourceNode = ctx.createMediaStreamSource(this.stream);
    this.sourceNode.connect(destination);
  }

  disconnect(): void {
    this.sourceNode?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.sourceNode = null;
    this.stream = null;
  }

  isActive(): boolean {
    return this.stream !== null;
  }
}
