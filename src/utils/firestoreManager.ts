import { firestore } from './firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  type QuerySnapshot
} from 'firebase/firestore';
import type { QuizRow } from './excelParser';

export interface Quiz {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizEntry extends QuizRow {
  id: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

class FirestoreManager {
  private quizzesCollection = 'quizzes';
  private entriesSubcollection = 'entries';

  // ========== QUIZ OPERATIONS ==========

  async createQuiz(name: string): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    const quizRef = await addDoc(collection(firestore, this.quizzesCollection), {
      name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('Firestore: Created quiz:', quizRef.id);
    return quizRef.id;
  }

  async getQuiz(quizId: string): Promise<Quiz | null> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    const quizDoc = await getDoc(doc(firestore, this.quizzesCollection, quizId));
    if (!quizDoc.exists()) {
      console.log('Firestore: Quiz not found:', quizId);
      return null;
    }
    
    const data = quizDoc.data();
    return {
      id: quizDoc.id,
      name: data.name || '',
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    };
  }

  async listQuizzes(): Promise<Quiz[]> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    const q = query(
      collection(firestore, this.quizzesCollection),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const quizzes = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    }));
    
    console.log('Firestore: Listed quizzes:', quizzes.length);
    return quizzes;
  }

  async updateQuiz(quizId: string, name: string): Promise<void> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    await updateDoc(doc(firestore, this.quizzesCollection, quizId), {
      name,
      updatedAt: serverTimestamp()
    });
    
    console.log('Firestore: Updated quiz:', quizId);
  }

  async deleteQuiz(quizId: string): Promise<void> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    // Delete all entries first
    const entries = await this.getEntries(quizId);
    await Promise.all(entries.map(entry => this.deleteEntry(quizId, entry.id)));
    
    // Delete quiz
    await deleteDoc(doc(firestore, this.quizzesCollection, quizId));
    
    console.log('Firestore: Deleted quiz:', quizId);
  }

  // ========== ENTRY OPERATIONS ==========

  async addEntry(quizId: string, entry: QuizRow, order?: number): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    // Get current max order if not provided
    if (order === undefined) {
      const entries = await this.getEntries(quizId);
      order = entries.length > 0 
        ? Math.max(...entries.map(e => e.order)) + 1 
        : 0;
    }
    
    const entryRef = await addDoc(
      collection(firestore, this.quizzesCollection, quizId, this.entriesSubcollection),
      {
        ...entry,
        order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );
    
    // Update quiz timestamp
    const quiz = await this.getQuiz(quizId);
    if (quiz) {
      await updateDoc(doc(firestore, this.quizzesCollection, quizId), {
        updatedAt: serverTimestamp()
      });
    }
    
    console.log('Firestore: Added entry:', entryRef.id, 'to quiz:', quizId);
    return entryRef.id;
  }

  async getEntries(quizId: string): Promise<QuizEntry[]> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    const q = query(
      collection(firestore, this.quizzesCollection, quizId, this.entriesSubcollection),
      orderBy('order', 'asc')
    );
    
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        Team: data.Team || '',
        Word: data.Word || '',
        Pronunciation: data.Pronunciation || '',
        AlternativePronunciation: data.AlternativePronunciation || '',
        WordOrigin: data.WordOrigin || '',
        Meaning: data.Meaning || '',
        WordInContext: data.WordInContext || '',
        order: data.order || 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      };
    });
    
    return entries;
  }

  async updateEntry(quizId: string, entryId: string, entry: Partial<QuizRow>): Promise<void> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    await updateDoc(
      doc(firestore, this.quizzesCollection, quizId, this.entriesSubcollection, entryId),
      {
        ...entry,
        updatedAt: serverTimestamp()
      }
    );
    
    // Update quiz timestamp
    const quiz = await this.getQuiz(quizId);
    if (quiz) {
      await updateDoc(doc(firestore, this.quizzesCollection, quizId), {
        updatedAt: serverTimestamp()
      });
    }
    
    console.log('Firestore: Updated entry:', entryId);
  }

  async deleteEntry(quizId: string, entryId: string): Promise<void> {
    if (!firestore) throw new Error('Firestore not initialized');
    
    await deleteDoc(
      doc(firestore, this.quizzesCollection, quizId, this.entriesSubcollection, entryId)
    );
    
    // Update quiz timestamp
    const quiz = await this.getQuiz(quizId);
    if (quiz) {
      await updateDoc(doc(firestore, this.quizzesCollection, quizId), {
        updatedAt: serverTimestamp()
      });
    }
    
    console.log('Firestore: Deleted entry:', entryId);
  }

  // ========== BULK OPERATIONS ==========

  async importEntries(quizId: string, entries: QuizRow[]): Promise<string[]> {
    const entryIds: string[] = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entryId = await this.addEntry(quizId, entries[i], i);
      entryIds.push(entryId);
    }
    
    console.log('Firestore: Imported', entries.length, 'entries to quiz:', quizId);
    return entryIds;
  }

  // ========== REAL-TIME LISTENERS ==========

  subscribeToEntries(
    quizId: string,
    callback: (entries: QuizEntry[]) => void
  ): () => void {
    if (!firestore) {
      console.warn('Firestore not initialized');
      return () => {};
    }

    const q = query(
      collection(firestore, this.quizzesCollection, quizId, this.entriesSubcollection),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot: QuerySnapshot) => {
        const entries: QuizEntry[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            Team: data.Team || '',
            Word: data.Word || '',
            Pronunciation: data.Pronunciation || '',
            AlternativePronunciation: data.AlternativePronunciation || '',
            WordOrigin: data.WordOrigin || '',
            Meaning: data.Meaning || '',
            WordInContext: data.WordInContext || '',
            order: data.order || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          };
        });
        console.log('Firestore: Real-time update -', entries.length, 'entries');
        callback(entries);
      },
      (error: Error) => {
        console.error('Firestore: Error listening to entries:', error);
      }
    );

    return unsubscribe;
  }

  subscribeToQuizzes(callback: (quizzes: Quiz[]) => void): () => void {
    if (!firestore) {
      console.warn('Firestore not initialized');
      return () => {};
    }

    const q = query(
      collection(firestore, this.quizzesCollection),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot: QuerySnapshot) => {
        const quizzes = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          };
        });
        console.log('Firestore: Real-time update -', quizzes.length, 'quizzes');
        callback(quizzes);
      },
      (error: Error) => {
        console.error('Firestore: Error listening to quizzes:', error);
      }
    );

    return unsubscribe;
  }

  // ========== UTILITY METHODS ==========

  isFirestoreEnabled(): boolean {
    return firestore !== null;
  }
}

export const firestoreManager = new FirestoreManager();



