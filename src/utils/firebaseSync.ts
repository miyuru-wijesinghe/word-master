import { database } from './firebaseConfig';
import { ref, onValue, off, push, serverTimestamp, type DatabaseReference } from 'firebase/database';
import type { QuizMessage } from './broadcast';

// Firebase sync manager for cross-device communication
class FirebaseSyncManager {
  private roomId: string;
  private messageRef: DatabaseReference | null = null;
  private listeners: ((message: QuizMessage) => void)[] = [];
  private isEnabled: boolean = false;

  constructor(roomId: string = 'default-room') {
    this.roomId = roomId;
    this.isEnabled = database !== null;
    
    if (this.isEnabled) {
      // Create reference to messages for this room
      this.messageRef = ref(database!, `rooms/${this.roomId}/messages`);
      
      // Set up listener for new messages
      this.setupListener();
      
      console.log(`Firebase sync enabled for room: ${this.roomId}`);
    } else {
      console.warn('Firebase not available. Cross-device sync disabled.');
    }
  }

  private setupListener() {
    if (!this.messageRef || !this.isEnabled) return;

    // Listen for new messages
    onValue(this.messageRef, (snapshot: any) => {
      const messages = snapshot.val();
      
      if (messages) {
        // Get the latest message (Firebase orders by push key)
        const messageKeys = Object.keys(messages);
        const latestKey = messageKeys[messageKeys.length - 1];
        const latestMessage = messages[latestKey];
        
        if (latestMessage && latestMessage.data) {
          // Notify all listeners
          this.listeners.forEach(listener => {
            try {
              listener(latestMessage.data);
            } catch (error) {
              console.error('Error in Firebase message listener:', error);
            }
          });
        }
      }
    }, (error: Error) => {
      console.error('Firebase listener error:', error);
    });
  }

  async send(message: QuizMessage): Promise<void> {
    if (!this.messageRef || !this.isEnabled) {
      return; // Silently fail if Firebase not available
    }

    try {
      // Push message to Firebase
      await push(this.messageRef, {
        data: message,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending message to Firebase:', error);
    }
  }

  listen(callback: (message: QuizMessage) => void): () => void {
    this.listeners.push(callback);

    // Return cleanup function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  setRoomId(roomId: string) {
    // Clean up old listener
    if (this.messageRef) {
      off(this.messageRef);
    }

    this.roomId = roomId;
    
    if (this.isEnabled && database) {
      this.messageRef = ref(database, `rooms/${this.roomId}/messages`);
      this.setupListener();
      console.log(`Firebase room changed to: ${this.roomId}`);
    }
  }

  getRoomId(): string {
    return this.roomId;
  }

  isFirebaseEnabled(): boolean {
    return this.isEnabled;
  }

  cleanup() {
    if (this.messageRef) {
      off(this.messageRef);
      this.messageRef = null;
    }
    this.listeners = [];
  }
}

// Singleton instance with default room
export const firebaseSyncManager = new FirebaseSyncManager();

