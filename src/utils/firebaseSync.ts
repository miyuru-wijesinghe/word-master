import { database } from './firebaseConfig';
import { ref, onValue, off, push, serverTimestamp, type DatabaseReference } from 'firebase/database';
import type { QuizMessage } from './broadcast';

// Firebase sync manager for cross-device communication
class FirebaseSyncManager {
  private roomId: string;
  private messageRef: DatabaseReference | null = null;
  private listeners: ((message: QuizMessage) => void)[] = [];
  private isEnabled: boolean = false;
  // Track the last processed message key to avoid reprocessing
  private lastProcessedKey: string | null = null;
  // Track processed message signatures to prevent duplicates
  private processedSignatures: Set<string> = new Set();
  private signatureCleanupInterval: number | null = null;

  constructor(roomId: string = 'default-room') {
    this.roomId = roomId;
    this.isEnabled = database !== null;
    
    if (this.isEnabled) {
      // Create reference to messages for this room
      this.messageRef = ref(database!, `rooms/${this.roomId}/messages`);
      
      // Set up listener for new messages
      this.setupListener();
      
      // Clean up old signatures periodically to prevent memory leak and cache issues
      this.signatureCleanupInterval = window.setInterval(() => {
        // Keep only last 200 signatures (increased for better reliability)
        if (this.processedSignatures.size > 200) {
          const signaturesArray = Array.from(this.processedSignatures);
          this.processedSignatures.clear();
          // Keep the last 100 (increased from 50)
          signaturesArray.slice(-100).forEach(sig => this.processedSignatures.add(sig));
          console.log('Firebase: Cleaned up old signatures, kept last 100');
        }
      }, 30000); // Every 30 seconds (more frequent cleanup)
      
      console.log(`Firebase sync enabled for room: ${this.roomId}`);
    } else {
      console.warn('Firebase not available. Cross-device sync disabled.');
    }
  }

  private setupListener() {
    if (!this.messageRef || !this.isEnabled) return;

    // Listen for new messages - process ALL messages, not just the latest
    onValue(this.messageRef, (snapshot: any) => {
      const messages = snapshot.val();
      
      if (messages) {
        const messageKeys = Object.keys(messages).sort(); // Ensure keys are sorted
        
        let keysToProcess: string[];
        
        if (this.lastProcessedKey === null) {
          // On initial load, only process the latest message to avoid reprocessing old messages
          // This prevents showing stale data when a page loads
          if (messageKeys.length > 0) {
        const latestKey = messageKeys[messageKeys.length - 1];
            keysToProcess = [latestKey];
            // Set lastProcessedKey to the latest key so we only process new messages going forward
            this.lastProcessedKey = latestKey;
            console.log('Firebase: Initial load - processing latest message only:', latestKey);
          } else {
            keysToProcess = [];
          }
        } else {
          // After initial load, process all new messages (after lastProcessedKey)
          keysToProcess = messageKeys.filter(key => {
            // Compare keys lexicographically (Firebase push keys are ordered)
            return key > this.lastProcessedKey!;
          });
        }
        
        // Process messages in order
        keysToProcess.forEach(key => {
          const message = messages[key];
        
          if (message && message.data) {
            const now = Date.now();
            const messageTimestamp = (typeof message.timestamp === 'number' ? message.timestamp : null) 
              || (typeof message.data.sentAt === 'number' ? message.data.sentAt : null);
            const STALE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes max age for replayed messages
            if (messageTimestamp && now - messageTimestamp > STALE_LIMIT_MS) {
              console.warn('Firebase: Skipping stale message older than 5 minutes:', key, message.data.type);
              this.lastProcessedKey = key;
              return;
            }

            // Create a signature to prevent duplicate processing
            // Use message type + key data to create unique signature
            const signature = this.createMessageSignature(message.data, key);
            
            // Skip if already processed (additional safety check)
            if (this.processedSignatures.has(signature)) {
              console.log('Firebase: Skipping duplicate message:', signature);
              return;
            }
            
            // Mark as processed BEFORE updating lastProcessedKey to prevent race conditions
            this.processedSignatures.add(signature);
            
            // Update last processed key
            this.lastProcessedKey = key;
            
            console.log('Firebase: Processing message:', message.data.type, 'key:', key);
            
          // Notify all listeners
          this.listeners.forEach(listener => {
            try {
                listener(message.data);
            } catch (error) {
              console.error('Error in Firebase message listener:', error);
            }
          });
        }
        });
      }
    }, (error: Error) => {
      console.error('Firebase listener error:', error);
    });
  }

  // Create a unique signature for a message to detect duplicates
  private createMessageSignature(message: QuizMessage, key: string): string {
    // For judge messages, use type + actualWord + typedWord + key
    // For other messages, use type + key + relevant data
    if (message.type === 'judge' && message.judgeData) {
      return `judge:${message.judgeData.actualWord}:${message.judgeData.typedWord}:${key}`;
    }
    // For control messages, include action to make them unique
    if (message.type === 'control' && message.control?.action) {
      return `${message.type}:${message.control.action}:${key}`;
    }
    // For video messages, include action to make them unique
    if (message.type === 'video' && message.videoData?.action) {
      return `${message.type}:${message.videoData.action}:${key}`;
    }
    // For other message types, use type + key
    return `${message.type}:${key}`;
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
    // Reset tracking when changing rooms - clears cache
    this.lastProcessedKey = null;
    this.processedSignatures.clear();
    console.log('Firebase: Room changed, cache cleared');
    
    if (this.isEnabled && database) {
      this.messageRef = ref(database, `rooms/${this.roomId}/messages`);
      this.setupListener();
      console.log(`Firebase room changed to: ${this.roomId}`);
    }
  }
  
  // Method to clear cache manually (useful for debugging or forced refresh)
  clearCache() {
    this.lastProcessedKey = null;
    this.processedSignatures.clear();
    console.log('Firebase: Cache manually cleared');
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
    // Clear all cache on cleanup
    this.processedSignatures.clear();
    this.lastProcessedKey = null;
    if (this.signatureCleanupInterval !== null) {
      clearInterval(this.signatureCleanupInterval);
      this.signatureCleanupInterval = null;
    }
    console.log('Firebase: Cleanup completed, all cache cleared');
  }
}

// Singleton instance with default room
export const firebaseSyncManager = new FirebaseSyncManager();

