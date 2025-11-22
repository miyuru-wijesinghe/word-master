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

  // Public method to ensure audio context is initialized
  public ensureAudioContext() {
    try {
      if (!this.audioContext) {
        this.initAudioContext();
      }
      // Resume audio context if suspended (required by some browsers)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        // Try to resume - this requires user interaction in some browsers
        const resumePromise = this.audioContext.resume();
        if (resumePromise) {
          resumePromise.then(() => {
            console.log('AudioContext resumed successfully');
          }).catch((error) => {
            console.warn('AudioContext resume failed:', error);
          });
        }
      }
    } catch (e) {
      // If initialization fails, it will be retried on next user interaction
      console.warn('AudioContext initialization failed:', e);
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    this.ensureAudioContext();
    if (!this.audioContext) {
      console.warn('AudioContext not available, cannot play tone');
      return;
    }

    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(err => {
        console.warn('Failed to resume audio context:', err);
      });
    }

    try {
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
    } catch (error) {
      console.error('Error playing tone:', error);
    }
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
    // Two beeps for correct spelling - pleasant high-pitched beeps
    console.log('playCorrectSound called');
    this.ensureAudioContext();
    if (!this.audioContext) {
      console.warn('AudioContext not available for correct sound');
      return;
    }
    // First beep - higher frequency, pleasant beep
    this.playTone(880, 0.25, 'sine', 0.5);
    // Second beep - slightly higher, after short delay
    setTimeout(() => {
      this.playTone(1000, 0.25, 'sine', 0.5);
    }, 150);
  }

  public playIncorrectSound() {
    // Two beeps for incorrect spelling - warning beeps
    console.log('playIncorrectSound called');
    this.ensureAudioContext();
    if (!this.audioContext) {
      console.warn('AudioContext not available for incorrect sound');
      return;
    }
    // First beep - lower frequency, warning beep
    this.playTone(300, 0.4, 'square', 0.6);
    // Second beep - even lower, after short delay
    setTimeout(() => {
      this.playTone(250, 0.4, 'square', 0.6);
    }, 200);
  }

  public playWordClearBeep() {
    // Longer, louder cue when the latest result card fades out
    this.playTone(760, 0.55, 'triangle', 0.8);
    setTimeout(() => this.playTone(560, 0.6, 'square', 0.75), 420);
    setTimeout(() => this.playTone(420, 0.65, 'sine', 0.7), 900);
  }
}

export const soundManager = SoundManager.getInstance();
