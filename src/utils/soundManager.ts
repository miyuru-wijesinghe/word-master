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

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
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
    // Simple beep sound when timer ends - louder volume and longer duration
    this.playTone(600, 0.8, 'sine', 0.6);
  }

  public playCorrectSound() {
    // Positive chime for correct spelling
    this.playTone(900, 0.25, 'sine', 0.6);
    setTimeout(() => this.playTone(1100, 0.25, 'triangle', 0.5), 180);
  }

  public playIncorrectSound() {
    // Lower buzz for incorrect spelling
    this.playTone(200, 0.35, 'sawtooth', 0.5);
    setTimeout(() => this.playTone(160, 0.4, 'sawtooth', 0.4), 220);
  }
}

export const soundManager = SoundManager.getInstance();
