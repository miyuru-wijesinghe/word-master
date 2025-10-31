import { firebaseSyncManager } from './firebaseSync';

export interface QuizMessage {
  type: 'update' | 'pause' | 'end' | 'clear' | 'speech' | 'control' | 'video';
  data?: {
    student: string;
    word: string;
    timeLeft: number;
    isRunning: boolean;
    duration?: number;
  };
  speechData?: {
    timeLeft: number;
    shouldSpeak: boolean;
  };
  selectedEntries?: Array<{
    word: string;
    team: string;
  }>;
  control?: {
    action: 'start' | 'pause' | 'end' | 'addTime';
    addSeconds?: number;
    duration?: number;
  };
  videoData?: {
    url: string;
    isPlaying: boolean;
    action?: 'play' | 'pause' | 'stop';
  };
}

class BroadcastManager {
  private channel: BroadcastChannel;
  private listeners: ((message: QuizMessage) => void)[] = [];
  private firebaseListeners: Map<Function, () => void> = new Map();

  constructor() {
    this.channel = new BroadcastChannel('quizSync');
    this.channel.onmessage = (event) => {
      this.listeners.forEach(listener => listener(event.data));
    };

    // Also listen to Firebase for cross-device sync
    if (firebaseSyncManager.isFirebaseEnabled()) {
      firebaseSyncManager.listen((message: QuizMessage) => {
        // Only process if it's from a different device (not from our own BroadcastChannel)
        // We'll rely on Firebase timestamps to prevent duplicate processing
        this.listeners.forEach(listener => listener(message));
      });
    }

    // Initialize room ID from environment variable if available
    const roomId = import.meta.env.VITE_ROOM_ID || 'default-room';
    if (firebaseSyncManager.isFirebaseEnabled()) {
      firebaseSyncManager.setRoomId(roomId);
    }
  }

  send(message: QuizMessage) {
    // Send via BroadcastChannel for same-device sync (fast, immediate)
    this.channel.postMessage(message);
    
    // Also send via Firebase for cross-device sync
    if (firebaseSyncManager.isFirebaseEnabled()) {
      firebaseSyncManager.send(message).catch(error => {
        console.error('Firebase send error:', error);
      });
    }
  }

  sendSpeech(timeLeft: number, shouldSpeak: boolean) {
    this.send({
      type: 'speech',
      speechData: { timeLeft, shouldSpeak }
    });
  }

  listen(callback: (message: QuizMessage) => void) {
    // Add to BroadcastChannel listeners (same-device)
    this.listeners.push(callback);
    
    // Also add to Firebase listeners if enabled (cross-device)
    if (firebaseSyncManager.isFirebaseEnabled()) {
      const cleanup = firebaseSyncManager.listen(callback);
      this.firebaseListeners.set(callback, cleanup);
    }
    
    // Return cleanup function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
      
      // Cleanup Firebase listener
      const firebaseCleanup = this.firebaseListeners.get(callback);
      if (firebaseCleanup) {
        firebaseCleanup();
        this.firebaseListeners.delete(callback);
      }
    };
  }

  setRoomId(roomId: string) {
    firebaseSyncManager.setRoomId(roomId);
  }

  getRoomId(): string {
    return firebaseSyncManager.getRoomId();
  }

  isFirebaseEnabled(): boolean {
    return firebaseSyncManager.isFirebaseEnabled();
  }

  close() {
    this.channel.close();
    firebaseSyncManager.cleanup();
  }
}

// Singleton instance
export const broadcastManager = new BroadcastManager();
