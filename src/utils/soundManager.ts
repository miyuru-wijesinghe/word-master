// Sound effects utility
export class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;

  private constructor() {
    // Initialize audio context on first user interaction
    if (typeof window !== 'undefined') {
      document.addEventListener('click', this.initAudioContext.bind(this), { once: true });
    }
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  public playStartSound() {
    this.playTone(800, 0.2);
    setTimeout(() => this.playTone(1000, 0.2), 100);
  }

  public playPauseSound() {
    this.playTone(400, 0.3);
  }

  public playEndSound() {
    this.playTone(200, 0.5);
    setTimeout(() => this.playTone(150, 0.5), 200);
  }

  public playTickSound() {
    this.playTone(600, 0.1);
  }

  public playWarningSound() {
    this.playTone(1000, 0.1);
    setTimeout(() => this.playTone(1000, 0.1), 150);
  }

  public playCountdownBeep() {
    // Short beep for countdown milestones
    this.playTone(800, 0.15);
  }

  public playTimerEndBeep() {
    // Longer beep when timer ends
    this.playTone(600, 0.8);
    setTimeout(() => this.playTone(500, 0.8), 200);
    setTimeout(() => this.playTone(400, 0.8), 400);
  }
}

export const soundManager = SoundManager.getInstance();
