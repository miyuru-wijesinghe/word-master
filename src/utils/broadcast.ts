export interface QuizMessage {
  type: 'update' | 'pause' | 'end' | 'clear' | 'speech';
  data?: {
    student: string;
    word: string;
    timeLeft: number;
    isRunning: boolean;
  };
  speechData?: {
    timeLeft: number;
    shouldSpeak: boolean;
  };
}

class BroadcastManager {
  private channel: BroadcastChannel;
  private listeners: ((message: QuizMessage) => void)[] = [];

  constructor() {
    this.channel = new BroadcastChannel('quizSync');
    this.channel.onmessage = (event) => {
      this.listeners.forEach(listener => listener(event.data));
    };
  }

  send(message: QuizMessage) {
    this.channel.postMessage(message);
  }

  sendSpeech(timeLeft: number, shouldSpeak: boolean) {
    this.send({
      type: 'speech',
      speechData: { timeLeft, shouldSpeak }
    });
  }

  listen(callback: (message: QuizMessage) => void) {
    this.listeners.push(callback);
    
    // Return cleanup function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  close() {
    this.channel.close();
  }
}

// Singleton instance
export const broadcastManager = new BroadcastManager();
