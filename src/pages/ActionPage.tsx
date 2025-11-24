import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { parseExcelFile } from '../utils/excelParser';
import type { QuizRow } from '../utils/excelParser';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
import { firestoreManager, type Quiz, type QuizEntry } from '../utils/firestoreManager';
import * as XLSX from 'xlsx';

export const ActionPage: React.FC = () => {
  const [quizData, setQuizData] = useState<QuizRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [startedRow, setStartedRow] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentStudent, setCurrentStudent] = useState('');
  const [currentWord, setCurrentWord] = useState('');
  const [judgeResult, setJudgeResult] = useState<{ isCorrect: boolean; actualWord: string; typedWord: string } | null>(null);
  const [showJudgeAlert, setShowJudgeAlert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const judgeAlertTimeoutRef = useRef<number | null>(null);
  const JUDGE_ALERT_AUTO_HIDE_MS = 6000;
  useEffect(() => {
    if (showJudgeAlert && judgeResult) {
      if (judgeAlertTimeoutRef.current) {
        clearTimeout(judgeAlertTimeoutRef.current);
      }
      judgeAlertTimeoutRef.current = window.setTimeout(() => {
        setShowJudgeAlert(false);
        setJudgeResult(null);
        judgeAlertTimeoutRef.current = null;
      }, JUDGE_ALERT_AUTO_HIDE_MS);
    }

    return () => {
      if (judgeAlertTimeoutRef.current) {
        clearTimeout(judgeAlertTimeoutRef.current);
        judgeAlertTimeoutRef.current = null;
      }
    };
  }, [showJudgeAlert, judgeResult]);

  
  // Firestore state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [showCreateQuizModal, setShowCreateQuizModal] = useState(false);
  const [newQuizName, setNewQuizName] = useState('');
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<QuizEntry | null>(null);
  const [entryForm, setEntryForm] = useState<QuizRow>({
    Team: '',
    Word: '',
    Pronunciation: '',
    AlternativePronunciation: '',
    WordOrigin: '',
    Meaning: '',
    WordInContext: ''
  });

  // ========== FIRESTORE OPERATIONS ==========
  
  // Load all quizzes
  const loadQuizzes = async () => {
    if (!firestoreManager.isFirestoreEnabled()) {
      console.warn('Firestore not enabled');
      return;
    }
    
    setIsLoadingQuizzes(true);
    try {
      const quizList = await firestoreManager.listQuizzes();
      setQuizzes(quizList);
      console.log('Loaded quizzes:', quizList.length);
    } catch (error) {
      console.error('Error loading quizzes:', error);
      alert('Failed to load quizzes: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingQuizzes(false);
    }
  };

  // Load entries for selected quiz
  const loadQuizEntries = async (quizId: string) => {
    if (!firestoreManager.isFirestoreEnabled()) {
      console.warn('Firestore not enabled');
      return;
    }
    
    setIsLoadingEntries(true);
    try {
      const entries = await firestoreManager.getEntries(quizId);
      // Convert QuizEntry[] to QuizRow[] for compatibility
      const rows: QuizRow[] = entries.map(entry => ({
        Team: entry.Team,
        Word: entry.Word,
        Pronunciation: entry.Pronunciation,
        AlternativePronunciation: entry.AlternativePronunciation,
        WordOrigin: entry.WordOrigin,
        Meaning: entry.Meaning,
        WordInContext: entry.WordInContext
      }));
      setQuizData(rows);
      setSelectedRows([]);
      setStartedRow(null);
      console.log('Loaded entries:', entries.length);
    } catch (error) {
      console.error('Error loading entries:', error);
      alert('Failed to load quiz entries: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingEntries(false);
    }
  };

  // Create new quiz
  const handleCreateQuiz = async () => {
    if (!newQuizName.trim()) {
      alert('Please enter a quiz name');
      return;
    }
    
    try {
      const quizId = await firestoreManager.createQuiz(newQuizName.trim());
      await loadQuizzes();
      setSelectedQuizId(quizId);
      await loadQuizEntries(quizId);
      setShowCreateQuizModal(false);
      setNewQuizName('');
      alert('Quiz created successfully!');
    } catch (error) {
      console.error('Error creating quiz:', error);
      alert('Failed to create quiz: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle quiz selection
  const handleSelectQuiz = async (quizId: string) => {
    setSelectedQuizId(quizId);
    await loadQuizEntries(quizId);
  };

  // Handle add entry
  const handleAddEntry = async () => {
    if (!selectedQuizId) {
      alert('Please select a quiz first');
      return;
    }
    
    if (!entryForm.Word.trim()) {
      alert('Please enter a word');
      return;
    }
    
    try {
      await firestoreManager.addEntry(selectedQuizId, entryForm);
      await loadQuizEntries(selectedQuizId);
      setShowAddEntryModal(false);
      setEntryForm({
        Team: '',
        Word: '',
        Pronunciation: '',
        AlternativePronunciation: '',
        WordOrigin: '',
        Meaning: '',
        WordInContext: ''
      });
    } catch (error) {
      console.error('Error adding entry:', error);
      alert('Failed to add entry: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle edit entry
  const handleEditEntry = async () => {
    if (!selectedQuizId || !editingEntry) {
      return;
    }
    
    try {
      await firestoreManager.updateEntry(selectedQuizId, editingEntry.id, entryForm);
      await loadQuizEntries(selectedQuizId);
      setEditingEntry(null);
      setEntryForm({
        Team: '',
        Word: '',
        Pronunciation: '',
        AlternativePronunciation: '',
        WordOrigin: '',
        Meaning: '',
        WordInContext: ''
      });
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Failed to update entry: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!selectedQuizId) {
      return;
    }
    
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }
    
    try {
      await firestoreManager.deleteEntry(selectedQuizId, entryId);
      await loadQuizEntries(selectedQuizId);
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle delete quiz
  const handleDeleteQuiz = async () => {
    if (!selectedQuizId) {
      alert('No quiz selected');
      return;
    }
    
    const quiz = quizzes.find(q => q.id === selectedQuizId);
    const quizName = quiz?.name || 'this quiz';
    
    if (!confirm(`Are you sure you want to delete "${quizName}"? This will delete all entries in this quiz and cannot be undone.`)) {
      return;
    }
    
    try {
      await firestoreManager.deleteQuiz(selectedQuizId);
      setSelectedQuizId(null);
      setQuizData([]);
      setSelectedRows([]);
      await loadQuizzes();
      alert('Quiz deleted successfully');
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('Failed to delete quiz: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Open edit modal
  const openEditModal = (entry: QuizEntry) => {
    setEditingEntry(entry);
    setEntryForm({
      Team: entry.Team,
      Word: entry.Word,
      Pronunciation: entry.Pronunciation,
      AlternativePronunciation: entry.AlternativePronunciation,
      WordOrigin: entry.WordOrigin,
      Meaning: entry.Meaning,
      WordInContext: entry.WordInContext
    });
    setShowAddEntryModal(true);
  };

  // Load quizzes on mount and subscribe to real-time updates
  useEffect(() => {
    if (!firestoreManager.isFirestoreEnabled()) {
      console.warn('Firestore not enabled, skipping quiz loading');
      return;
    }
    
    loadQuizzes();
    
    // Subscribe to real-time quiz updates
    const unsubscribe = firestoreManager.subscribeToQuizzes((updatedQuizzes) => {
      setQuizzes(updatedQuizzes);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Subscribe to real-time entry updates when quiz is selected
  useEffect(() => {
    if (!selectedQuizId || !firestoreManager.isFirestoreEnabled()) {
      return;
    }
    
    const unsubscribe = firestoreManager.subscribeToEntries(selectedQuizId, (entries) => {
      const rows: QuizRow[] = entries.map(entry => ({
        Team: entry.Team,
        Word: entry.Word,
        Pronunciation: entry.Pronunciation,
        AlternativePronunciation: entry.AlternativePronunciation,
        WordOrigin: entry.WordOrigin,
        Meaning: entry.Meaning,
        WordInContext: entry.WordInContext
      }));
      setQuizData(rows);
    });
    
    return () => {
      unsubscribe();
    };
  }, [selectedQuizId]);

  // Handle row selection - single selection, don't start
  const handleSelectRow = (index: number) => {
    // Validate index and quizData
    if (index < 0 || index >= quizData.length || !quizData[index]) {
      console.error('ActionPage: Invalid row index:', index, 'quizData length:', quizData.length);
      return;
    }
    
    const isAlreadySelected = selectedRows.length === 1 && selectedRows[0] === index;
    
    // Only keep one selection at a time
    const newSelectedRows = isAlreadySelected ? [] : [index];
    
    setSelectedRows(newSelectedRows);
    
    // Get the last selected row's word to display in ManageScreen
    const lastSelectedIndex = newSelectedRows.length > 0 ? newSelectedRows[0] : -1;
    const lastRow = lastSelectedIndex >= 0 && lastSelectedIndex < quizData.length ? quizData[lastSelectedIndex] : null;

    // Ensure we have valid data before broadcasting
    if (lastRow && lastRow.Word) {
      // Broadcast selected entries and current word to manage screen
      // Include word in data for ManageScreen, but set isRunning to false so ViewPage ignores it
      const message: QuizMessage = {
        type: 'update',
        data: {
          student: '',
          word: lastRow.Word,
          timeLeft: 0,
          isRunning: false  // ViewPage will ignore this because isRunning is false
        },
        selectedEntries: newSelectedRows
          .filter(i => i >= 0 && i < quizData.length && quizData[i] && quizData[i].Word)
          .map(i => ({
            word: quizData[i].Word,
            team: quizData[i].Team || ''
          }))
      };
      broadcastManager.send(message);
      console.log('ActionPage: Sent selection update:', { word: lastRow.Word, entries: message.selectedEntries });
    } else if (newSelectedRows.length === 0) {
      // Clear selection - send empty message
      const message: QuizMessage = {
        type: 'update',
        data: {
          student: '',
          word: '',
          timeLeft: 0,
          isRunning: false
        },
        selectedEntries: []
      };
      broadcastManager.send(message);
      console.log('ActionPage: Cleared selection');
    }
  };

  // Handle row updates from dropdowns (not used in new format, but kept for compatibility)
  const handleUpdateRow = (index: number, field: keyof QuizRow, value: string) => {
    setQuizData(prevData => {
      const newData = prevData.map((row, i) => {
        if (i === index) {
          return { ...row, [field]: value };
        }
        return row;
      });
      return newData;
    });
  };

  // Listen for control messages from ManageScreen and judge results
  useEffect(() => {
    const unsubscribe = broadcastManager.listen((message: QuizMessage) => {
      // Handle judge results - show alert on control panel and STOP TIMER IMMEDIATELY
      if (message.type === 'judge' && message.judgeData) {
        console.log('Control Panel: Received judge result:', message.judgeData);
        console.log('Control Panel: Typed word received:', {
          typedWord: message.judgeData.typedWord,
          type: typeof message.judgeData.typedWord,
          length: message.judgeData.typedWord?.length,
          actualWord: message.judgeData.actualWord,
          isCorrect: message.judgeData.isCorrect
        });
        
        // Mark that judge result was received - prevents timer from sending 'end' message
        judgeResultReceivedRef.current = true;
        console.log('Control Panel: Marked judge result received, will prevent timer end message');
        
        // STOP TIMER IMMEDIATELY when judge sends result
        if (timerIntervalRef.current !== null) {
          console.log('Control Panel: Stopping timer interval on judge result');
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        
        // Stop timer states immediately
        setIsRunning(false);
        setIsPaused(false);
        timeLeftRef.current = 0;
        
        // Ensure typedWord is always a string (even if empty - empty string is valid)
        // Handle all possible cases: undefined, null, empty string, or actual value
        const typedWord = (message.judgeData.typedWord !== undefined && message.judgeData.typedWord !== null)
          ? String(message.judgeData.typedWord)
          : '';
        const actualWord = String(message.judgeData.actualWord || '');
        
        // CRITICAL: Always set judgeResult and show alert, even if typedWord is empty
        // The alert should show regardless of whether a word was typed or not
        const resultData = {
          isCorrect: message.judgeData.isCorrect || false,
          actualWord: actualWord,
          typedWord: typedWord // Can be empty string - that's valid
        };
        
        console.log('Control Panel: Received judge result:', {
          actualWord: resultData.actualWord,
          typedWord: resultData.typedWord,
          typedWordType: typeof resultData.typedWord,
          typedWordLength: resultData.typedWord.length,
          isCorrect: resultData.isCorrect,
          rawTypedWord: message.judgeData.typedWord,
          rawTypedWordType: typeof message.judgeData.typedWord
        });
        console.log('Control Panel: Setting judge result:', resultData);
        setJudgeResult(resultData);
        setShowJudgeAlert(true);
        console.log('Control Panel: Alert should be visible now, typedWord:', typedWord, 'isEmpty:', typedWord === '', 'willDisplay:', typedWord && typedWord.trim() !== '' ? typedWord : '—');
        
      }
      
      if (message.type === 'control' && message.control) {
        const { action, addSeconds } = message.control;
        
        switch (action) {
          case 'start':
            // Reset judge result flag when starting new timer
            judgeResultReceivedRef.current = false;
            // Use functional update to get latest selectedRows
            setSelectedRows(currentSelected => {
              if (currentSelected.length > 0) {
                // Use the last selected row
                const lastSelectedIndex = currentSelected[currentSelected.length - 1];
                const selectedData = quizData[lastSelectedIndex];
                
                // Get duration from control message or default to 60
                const duration = message.control?.duration || 60;
                
                setCurrentStudent(''); // No longer using student name
                setCurrentWord(selectedData.Word);
                setStartedRow(lastSelectedIndex);
                updateTimerMetadata(duration);
                setIsRunning(true);
                setIsPaused(false);
                lastBeepRef.current = -1; // Reset beep tracking when timer starts
                
                // Validate data before sending
                const validSelectedEntries = currentSelected
                  .filter(i => i >= 0 && i < quizData.length && quizData[i] && quizData[i].Word)
                  .map(i => ({
                    word: quizData[i].Word,
                    team: quizData[i].Team || ''
                  }));
                
                const startMessage: QuizMessage = {
                  type: 'update',
                  data: {
                    student: '',
                    word: selectedData.Word,
                    timeLeft: duration,
                    isRunning: true,
                    duration,
                    endsAt: timerEndTimestampRef.current || undefined
                  },
                  selectedEntries: validSelectedEntries
                };
                broadcastManager.send(startMessage);
                console.log('ActionPage: Sent start message:', { word: selectedData.Word, entries: validSelectedEntries });
              }
              return currentSelected;
            });
            break;
          case 'pause':
            // Toggle pause state - avoid nested setState
            const newPaused = !isPausedRef.current;
            setIsPaused(newPaused);
            setIsRunning(!newPaused);
            
            // Use refs to get latest values for broadcast message
            const currentWordValue = currentWordRef.current;
            const currentStudentValue = currentStudentRef.current;
            const currentTimeLeft = timeLeftRef.current;

            if (newPaused) {
              pausedTimeLeftRef.current = currentTimeLeft;
              timerEndTimestampRef.current = null;
            } else {
              const resumeSeconds = pausedTimeLeftRef.current || currentTimeLeft;
              timerEndTimestampRef.current = Date.now() + Math.max(0, resumeSeconds) * 1000;
            }
            
            // Send pause message immediately - validate data
            const pauseQuizData = quizDataRef.current;
            const pauseSelectedRows = selectedRowsRef.current;
            const pauseValidEntries = pauseQuizData && pauseQuizData.length > 0
              ? pauseSelectedRows
                  .filter(i => i >= 0 && i < pauseQuizData.length && pauseQuizData[i] && pauseQuizData[i].Word)
                  .map(i => ({
                    word: pauseQuizData[i].Word,
                    team: pauseQuizData[i].Team || ''
                  }))
              : [];
            
            const pauseMessage: QuizMessage = {
              type: newPaused ? 'pause' : 'update',
              data: {
                student: currentStudentValue || '',
                word: currentWordValue || '',
                timeLeft: currentTimeLeft,
                isRunning: !newPaused,
                endsAt: timerEndTimestampRef.current || undefined
              },
              selectedEntries: pauseValidEntries
            };
            broadcastManager.send(pauseMessage);
            break;
          case 'end':
            console.log('ActionPage: Received control end message, stopping timer');
            // Reset judge result flag when manually ending
            judgeResultReceivedRef.current = false;
            // Stop timer interval immediately - CRITICAL to prevent timer from continuing
            if (timerIntervalRef.current !== null) {
              console.log('ActionPage: Clearing timer interval');
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            
            // Also ensure refs are updated to prevent interval from continuing
            isRunningRef.current = false;
            isPausedRef.current = false;
            
            // Get current word before clearing it - use refs to ensure we get the latest value
            const wordToShow = currentWordRef.current || (startedRow !== null && quizDataRef.current[startedRow] ? quizDataRef.current[startedRow].Word : '');
            
            // Stop timer immediately - set states first
            setIsRunning(false);
            setIsPaused(false);
            setTimeLeft(60);
            timeLeftRef.current = 60; // Update ref immediately
            setCurrentStudent('');
            setCurrentWord('');
            currentWordRef.current = ''; // Clear ref value too
            setStartedRow(null);
            clearTimerMetadata();
            
            // Broadcast end message with word included - validate data
            const endQuizData = quizDataRef.current;
            const endSelectedRows = selectedRowsRef.current;
            const endValidEntries = endQuizData && endQuizData.length > 0 && wordToShow
              ? endSelectedRows
                  .filter(i => i >= 0 && i < endQuizData.length && endQuizData[i] && endQuizData[i].Word)
                  .map(i => ({
                    word: endQuizData[i].Word,
                    team: endQuizData[i].Team || ''
                  }))
              : [];
            
            const endMessage: QuizMessage = {
              type: 'end',
              data: {
                student: '',
                word: wordToShow || '',
                timeLeft: 0,
                isRunning: false,
                endsAt: timerEndTimestampRef.current || undefined
              },
              selectedEntries: endValidEntries
            };
            broadcastManager.send(endMessage);
            console.log('ActionPage: Timer stopped and end message broadcasted:', { word: wordToShow, entries: endValidEntries });
            break;
          case 'addTime':
            if (addSeconds && (isRunning || isPaused)) {
              const newTime = Math.min(timeLeft + addSeconds, 3600); // Max 1 hour
              setTimeLeft(newTime);
              timeLeftRef.current = newTime;
              pausedTimeLeftRef.current = newTime;
              if (timerEndTimestampRef.current) {
                timerEndTimestampRef.current += addSeconds * 1000;
              } else if (isRunning) {
                timerEndTimestampRef.current = Date.now() + newTime * 1000;
              }
              
              // Broadcast updated time - validate data
              const addTimeValidEntries = quizData && quizData.length > 0
                ? selectedRows
                    .filter(i => i >= 0 && i < quizData.length && quizData[i] && quizData[i].Word)
                    .map(i => ({
                      word: quizData[i].Word,
                      team: quizData[i].Team || ''
                    }))
                : [];
              
              const updateMessage: QuizMessage = {
                type: 'update',
                data: {
                  student: currentStudent || '',
                  word: currentWord || '',
                  timeLeft: newTime,
                  isRunning: isRunning,
                  endsAt: timerEndTimestampRef.current || undefined
                },
                selectedEntries: addTimeValidEntries
              };
              broadcastManager.send(updateMessage);
            }
            break;
        }
      }
    });

    return () => {
      unsubscribe();
      if (judgeAlertTimeoutRef.current) {
        clearTimeout(judgeAlertTimeoutRef.current);
      }
    };
  }, [selectedRows, quizData, currentStudent, currentWord, isRunning, isPaused, timeLeft]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore key repeat events (when key is held down)
      if (event.repeat) {
        return;
      }

      // Only handle shortcuts when Ctrl/Cmd is pressed
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      // Only handle shortcuts when not typing in input fields
      const target = event.target as HTMLElement;
      if (
        target instanceof HTMLInputElement || 
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A'
      ) {
        return;
      }

      // Only handle specific shortcut keys
      const key = event.key.toLowerCase();
      if (key !== 's' && key !== 'p' && key !== 'e' && key !== 'u') {
        return;
      }

      // Prevent default only for our shortcuts
      event.preventDefault();
      event.stopPropagation();

      switch (key) {
        case 's':
          handleStart();
          break;
        case 'p':
          handlePause();
          break;
        case 'e':
          handleEnd();
          break;
        case 'u':
          fileInputRef.current?.click();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedRows, isRunning, isPaused]);

  // Excel import as migration tool (imports to selected quiz or creates new quiz)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Show loading state
    const originalButtonText = event.target.parentElement?.querySelector('button')?.textContent;
    const button = event.target.parentElement?.querySelector('button');
    if (button) {
      button.disabled = true;
      button.textContent = 'Importing...';
    }

    try {
      // Use setTimeout to yield to browser, making UI responsive
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Parse file asynchronously
      const data = await parseExcelFile(file);
      
      // Yield again before state updates
      await new Promise(resolve => setTimeout(resolve, 0));
      
      if (data.length === 0) {
        alert('No valid data found in the Excel file');
        return;
      }
      
      // If Firestore is enabled, import to database
      if (firestoreManager.isFirestoreEnabled()) {
        let quizId = selectedQuizId;
        
        // If no quiz selected, create a new one
        if (!quizId) {
          const quizName = file.name.replace(/\.(xlsx|xls)$/i, '') || 'Imported Quiz';
          quizId = await firestoreManager.createQuiz(quizName);
          await loadQuizzes();
          setSelectedQuizId(quizId);
        }
        
        // Import entries
        await firestoreManager.importEntries(quizId, data);
        await loadQuizEntries(quizId);
        alert(`Successfully imported ${data.length} entries to quiz!`);
      } else {
        // Fallback to old behavior if Firestore not enabled
        setQuizData(data);
        setSelectedRows([]);
        setStartedRow(null);
        setIsRunning(false);
        setIsPaused(false);
        setTimeLeft(60);
        setCurrentStudent('');
        setCurrentWord('');
      }
      
      // Clear any stale state by sending a clear message
      broadcastManager.send({
        type: 'clear'
      });
    } catch (error) {
      alert(`Error importing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Restore button state
      if (button) {
        button.disabled = false;
        if (originalButtonText) {
          button.textContent = originalButtonText;
        }
      }
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleStart = () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one row first');
      return;
    }

    // Use the last selected row (most recently selected)
    const lastSelectedIndex = selectedRows[selectedRows.length - 1];
    const selectedData = quizData[lastSelectedIndex];
    
    const duration = 60;
    setCurrentStudent(''); // No longer using student name
    setCurrentWord(selectedData.Word);
    setStartedRow(lastSelectedIndex);
    updateTimerMetadata(duration);
    setIsRunning(true);
    setIsPaused(false);

    // Broadcast to view page and manage screen - validate data
    const validSelectedEntries = quizData && quizData.length > 0
      ? selectedRows
          .filter(i => i >= 0 && i < quizData.length && quizData[i] && quizData[i].Word)
          .map(i => ({
            word: quizData[i].Word,
            team: quizData[i].Team || ''
          }))
      : [];
    
    const message: QuizMessage = {
      type: 'update',
      data: {
        student: '',
        word: selectedData.Word,
        timeLeft: duration,
        isRunning: true,
        duration,
        endsAt: timerEndTimestampRef.current || undefined
      },
      selectedEntries: validSelectedEntries
    };
    broadcastManager.send(message);
    console.log('ActionPage: Sent start message from handleStart:', { word: selectedData.Word, entries: validSelectedEntries });
  };

  const handlePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    setIsRunning(!newPaused);

    if (newPaused) {
      pausedTimeLeftRef.current = timeLeftRef.current;
      timerEndTimestampRef.current = null;
    } else {
      const resumeSeconds = pausedTimeLeftRef.current || timeLeftRef.current;
      timerEndTimestampRef.current = Date.now() + resumeSeconds * 1000;
    }
    
    // Validate data before sending
    const validSelectedEntries = quizData && quizData.length > 0
      ? selectedRows
          .filter(i => i >= 0 && i < quizData.length && quizData[i] && quizData[i].Word)
          .map(i => ({
            word: quizData[i].Word,
            team: quizData[i].Team || ''
          }))
      : [];
    
    const message: QuizMessage = {
      type: newPaused ? 'pause' : 'update',
      data: {
        student: currentStudent || '',
        word: currentWord || '',
        timeLeft,
        isRunning: !newPaused,
        endsAt: timerEndTimestampRef.current || undefined
      },
      selectedEntries: validSelectedEntries
    };
    broadcastManager.send(message);
  };

  const handleEnd = () => {
    // Get current word before clearing it
    const wordToShow = currentWord || (startedRow !== null && quizData[startedRow] ? quizData[startedRow].Word : '');
    
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(60);
    setCurrentStudent('');
    setCurrentWord('');
    setStartedRow(null);
    clearTimerMetadata();
    // Don't clear selectedRows - keep them for manage screen

    // Broadcast end to view page and manage screen - validate data
    const validSelectedEntries = quizData && quizData.length > 0 && wordToShow
      ? selectedRows
          .filter(i => i >= 0 && i < quizData.length && quizData[i] && quizData[i].Word)
          .map(i => ({
            word: quizData[i].Word,
            team: quizData[i].Team || ''
          }))
      : [];
    
    const message: QuizMessage = {
      type: 'end',
      data: {
        student: '',
        word: wordToShow || '',
        timeLeft: 0,
        isRunning: false,
        endsAt: timerEndTimestampRef.current || undefined
      },
      selectedEntries: validSelectedEntries
    };
    broadcastManager.send(message);
    console.log('ActionPage: Sent end message from handleEnd:', { word: wordToShow, entries: validSelectedEntries });
  };

  // Ref to track last beep time
  const lastBeepRef = useRef<number>(-1);
  
  // Ref to store interval ID so it can be cleared from within the callback
  const timerIntervalRef = useRef<number | null>(null);
  
  // Ref to track if judge result was received - prevents sending 'end' message when judge sends result
  const judgeResultReceivedRef = useRef<boolean>(false);
  
  // Refs to store current values for timer interval (prevents interval restart on state changes)
  const currentWordRef = useRef(currentWord);
  const currentStudentRef = useRef(currentStudent);
  const selectedRowsRef = useRef(selectedRows);
  const quizDataRef = useRef(quizData);
  const isRunningRef = useRef(isRunning);
  const isPausedRef = useRef(isPaused);
  const timeLeftRef = useRef(timeLeft);
  const timerEndTimestampRef = useRef<number | null>(null);
  const pausedTimeLeftRef = useRef<number>(timeLeft);

  const updateTimerMetadata = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    timerEndTimestampRef.current = Date.now() + safeSeconds * 1000;
    pausedTimeLeftRef.current = safeSeconds;
    timeLeftRef.current = safeSeconds;
    setTimeLeft(safeSeconds);
  };

  const clearTimerMetadata = () => {
    timerEndTimestampRef.current = null;
    pausedTimeLeftRef.current = 0;
  };

  useEffect(() => {
    currentWordRef.current = currentWord;
  }, [currentWord]);

  useEffect(() => {
    currentStudentRef.current = currentStudent;
  }, [currentStudent]);

  useEffect(() => {
    selectedRowsRef.current = selectedRows;
  }, [selectedRows]);

  useEffect(() => {
    quizDataRef.current = quizData;
  }, [quizData]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Timer interval - runs when timer is active
  useEffect(() => {
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    if (isRunning && !isPaused) {
      timerIntervalRef.current = window.setInterval(() => {
        if (!isRunningRef.current || isPausedRef.current) {
          if (timerIntervalRef.current !== null) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          return;
        }

        const endTimestamp = timerEndTimestampRef.current;
        const now = Date.now();
        const currentTime = timeLeftRef.current;
        const newTime = endTimestamp
          ? Math.max(0, Math.floor((endTimestamp - now) / 1000))
          : Math.max(0, currentTime - 1);

        pausedTimeLeftRef.current = newTime;
        timeLeftRef.current = newTime;
        setTimeLeft(newTime);

        if (newTime <= 0) {
          if (timerIntervalRef.current !== null) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }

          clearTimerMetadata();
          setIsRunning(false);
          setIsPaused(false);
          setStartedRow(null);
          timeLeftRef.current = 0;
          setTimeLeft(0);

          if (judgeResultReceivedRef.current) {
            console.log('ActionPage: Timer ended but judge result already received, skipping end message');
            judgeResultReceivedRef.current = false;
            return;
          }

          const endQuizData = quizDataRef.current;
          const endSelectedRows = selectedRowsRef.current;
          const endWord = currentWordRef.current;

          if (endWord && endQuizData && endQuizData.length > 0) {
            const validSelectedEntries = endSelectedRows
              .filter(i => i >= 0 && i < endQuizData.length && endQuizData[i] && endQuizData[i].Word)
              .map(i => ({
                word: endQuizData[i].Word,
                team: endQuizData[i].Team || ''
              }));

            const endMessage: QuizMessage = {
              type: 'end',
              data: {
                student: '',
                word: endWord,
                timeLeft: 0,
                isRunning: false,
                endsAt: timerEndTimestampRef.current || undefined
              },
              selectedEntries: validSelectedEntries
            };
            broadcastManager.send(endMessage);
            console.log('ActionPage: Sent timer end message:', { word: endWord, entries: validSelectedEntries });
          } else {
            console.warn('ActionPage: Skipping end message - invalid data:', {
              word: endWord,
              quizDataLength: endQuizData?.length || 0
            });
          }

          return;
        }

        if (
          newTime === 50 ||
          newTime === 40 ||
          newTime === 30 ||
          newTime === 20 ||
          newTime === 10
        ) {
          if (lastBeepRef.current !== newTime) {
            broadcastManager.sendSpeech(newTime, true);
            lastBeepRef.current = newTime;
          }
        } else if (newTime <= 10 && newTime > 0 && lastBeepRef.current !== newTime) {
          lastBeepRef.current = newTime;
          broadcastManager.sendSpeech(newTime, true);
        }

        const broadcastTime = newTime;
        setTimeout(() => {
          const updateQuizData = quizDataRef.current;
          const updateSelectedRows = selectedRowsRef.current;
          const updateWord = currentWordRef.current;
          const updateEndsAt = timerEndTimestampRef.current;
          const updateTime = updateEndsAt
            ? Math.max(0, Math.floor((updateEndsAt - Date.now()) / 1000))
            : broadcastTime;
          
          if (updateQuizData && updateQuizData.length > 0 && updateWord) {
            const validSelectedEntries = updateSelectedRows
              .filter(i => i >= 0 && i < updateQuizData.length && updateQuizData[i] && updateQuizData[i].Word)
              .map(i => ({
                word: updateQuizData[i].Word,
                team: updateQuizData[i].Team || ''
              }));
            
            const updateMessage: QuizMessage = {
              type: 'update',
              data: {
                student: currentStudentRef.current || '',
                word: updateWord,
                timeLeft: updateTime,
                isRunning: true,
                endsAt: updateEndsAt || undefined
              },
              selectedEntries: validSelectedEntries
            };
            broadcastManager.send(updateMessage);
          } else {
            console.warn('ActionPage: Skipping timer update - invalid data:', {
              quizDataLength: updateQuizData?.length || 0,
              word: updateWord,
              selectedRows: updateSelectedRows
            });
          }
        }, 0);
      }, 1000);
    }
    
    return () => {
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isRunning, isPaused]);

  // Save selected data as new Excel file
  const handleSaveData = () => {
    try {
      console.log('Save Data clicked');
      console.log('Selected rows:', selectedRows);
      console.log('Quiz data length:', quizData.length);
      
      if (selectedRows.length === 0) {
        alert('No selected entries to save. Please select some rows first.');
        return;
      }

      // Get only the selected entries
      const selectedData = selectedRows.map(index => {
        const row = quizData[index];
        console.log(`Row ${index}:`, row);
        return row;
      });

      console.log('Selected data to save:', selectedData);

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(selectedData);

      // Add worksheet to workbook (Excel sheet names max 31 chars)
      XLSX.utils.book_append_sheet(wb, ws, 'Selected Data');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `selected-spelling-challenge-${timestamp}.xlsx`;

      console.log('Saving file:', filename);

      // Save file
      XLSX.writeFile(wb, filename);
      
      console.log('File saved successfully');
      
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`❌ Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Judge Result Alert */}
      {showJudgeAlert && judgeResult && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/30 z-[9998]" 
            onClick={() => {
              setShowJudgeAlert(false);
              setJudgeResult(null);
              if (judgeAlertTimeoutRef.current) {
                clearTimeout(judgeAlertTimeoutRef.current);
              }
            }}
          />
          {/* Alert card */}
          <div 
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] max-w-2xl w-full mx-4" 
            style={{ pointerEvents: 'auto', position: 'fixed' }}
          >
          <div
            className={`rounded-2xl border-4 shadow-2xl p-6 animate-slide-down ${
              judgeResult.isCorrect
                ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400'
                : 'bg-gradient-to-br from-red-500 to-rose-600 border-red-400'
            }`}
            style={{ 
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              animation: 'slide-down 0.3s ease-out'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`text-5xl ${judgeResult.isCorrect ? 'text-green-100' : 'text-red-100'}`}>
                  {judgeResult.isCorrect ? '✅' : '❌'}
                </div>
                <div>
                  <h3 className={`text-3xl font-bold ${judgeResult.isCorrect ? 'text-green-50' : 'text-red-50'}`}>
                    {judgeResult.isCorrect ? 'CORRECT!' : 'INCORRECT'}
                  </h3>
                  <p className={`text-lg ${judgeResult.isCorrect ? 'text-green-100' : 'text-red-100'}`}>
                    Judge Result Received
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowJudgeAlert(false);
                  setJudgeResult(null);
                  if (judgeAlertTimeoutRef.current) {
                    clearTimeout(judgeAlertTimeoutRef.current);
                  }
                }}
                className={`text-2xl hover:opacity-80 transition-opacity ${
                  judgeResult.isCorrect ? 'text-green-100' : 'text-red-100'
                }`}
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className={`rounded-xl p-4 ${judgeResult.isCorrect ? 'bg-green-600/50' : 'bg-red-600/50'}`}>
                <p className={`text-sm font-semibold mb-2 ${judgeResult.isCorrect ? 'text-green-100' : 'text-red-100'}`}>
                  Correct Word
                </p>
                <p className={`text-2xl font-bold ${judgeResult.isCorrect ? 'text-green-50' : 'text-red-50'}`}>
                  {judgeResult.actualWord}
                </p>
              </div>
              <div className={`rounded-xl p-4 ${judgeResult.isCorrect ? 'bg-green-600/50' : 'bg-red-600/50'}`}>
                <p className={`text-sm font-semibold mb-2 ${judgeResult.isCorrect ? 'text-green-100' : 'text-red-100'}`}>
                  Spelled Word
                </p>
                <p className={`text-2xl font-bold ${judgeResult.isCorrect ? 'text-green-50' : 'text-red-50'}`}>
                  {judgeResult.typedWord && judgeResult.typedWord.trim() !== '' ? judgeResult.typedWord : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-slate-900">Control Panel</h1>
            <Link
              to="/"
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Quiz Management */}
        {firestoreManager.isFirestoreEnabled() && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Quiz Management</h2>
            
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Quiz</label>
                <select
                  value={selectedQuizId || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectQuiz(e.target.value);
                    } else {
                      setSelectedQuizId(null);
                      setQuizData([]);
                    }
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoadingQuizzes}
                >
                  <option value="">-- Select a quiz --</option>
                  {quizzes.map(quiz => (
                    <option key={quiz.id} value={quiz.id}>{quiz.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end gap-3">
                <button
                  onClick={() => setShowCreateQuizModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  ➕ Create Quiz
                </button>
                <button
                  onClick={() => {
                    setEditingEntry(null);
                    setEntryForm({
                      Team: '',
                      Word: '',
                      Pronunciation: '',
                      AlternativePronunciation: '',
                      WordOrigin: '',
                      Meaning: '',
                      WordInContext: ''
                    });
                    setShowAddEntryModal(true);
                  }}
                  disabled={!selectedQuizId}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  ➕ Add Entry
                </button>
                <button
                  onClick={handleDeleteQuiz}
                  disabled={!selectedQuizId}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  🗑️ Delete Quiz
                </button>
              </div>
            </div>

            {isLoadingEntries && (
              <div className="text-center py-4 text-slate-600">Loading entries...</div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              📁 {firestoreManager.isFirestoreEnabled() ? 'Import Excel' : 'Upload Excel'}
            </button>
            <button
              onClick={handleSaveData}
              disabled={selectedRows.length === 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              💾 Save Data
            </button>
          </div>

          {/* Keyboard Shortcuts Help */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Keyboard Shortcuts:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600">
              <div><kbd className="px-2 py-1 bg-slate-200 rounded">Ctrl+U</kbd> Upload</div>
              <div><kbd className="px-2 py-1 bg-slate-200 rounded">Ctrl+S</kbd> Start</div>
              <div><kbd className="px-2 py-1 bg-slate-200 rounded">Ctrl+P</kbd> Pause</div>
              <div><kbd className="px-2 py-1 bg-slate-200 rounded">Ctrl+E</kbd> End</div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />

        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Spelling Challenge Roster</h2>
            {firestoreManager.isFirestoreEnabled() && selectedQuizId && (
              <div className="text-sm text-slate-600">
                {quizData.length} {quizData.length === 1 ? 'entry' : 'entries'}
              </div>
            )}
          </div>
          
          {quizData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {firestoreManager.isFirestoreEnabled() 
                ? 'No entries yet. Select a quiz or create a new one to get started.'
                : 'No data uploaded yet. Please upload an Excel file.'}
            </div>
          ) : (
            <DataTable
              data={quizData}
              selectedRows={selectedRows}
              startedRow={startedRow}
              onSelectRow={handleSelectRow}
              onUpdateRow={handleUpdateRow}
              onEdit={firestoreManager.isFirestoreEnabled() ? (index) => {
                // Find the entry by index and open edit modal
                const entry = quizData[index];
                // We need to get the full entry with ID - for now, we'll need to track this differently
                // For simplicity, we'll reload entries and find by word/team match
                if (selectedQuizId) {
                  firestoreManager.getEntries(selectedQuizId).then(entries => {
                    const matchingEntry = entries.find(e => 
                      e.Word === entry.Word && e.Team === entry.Team
                    );
                    if (matchingEntry) {
                      openEditModal(matchingEntry);
                    }
                  });
                }
              } : undefined}
              onDelete={firestoreManager.isFirestoreEnabled() ? async (index) => {
                if (!selectedQuizId) return;
                const entry = quizData[index];
                const entries = await firestoreManager.getEntries(selectedQuizId);
                const matchingEntry = entries.find(e => 
                  e.Word === entry.Word && e.Team === entry.Team
                );
                if (matchingEntry) {
                  await handleDeleteEntry(matchingEntry.id);
                }
              } : undefined}
            />
          )}
        </div>

        {/* Create Quiz Modal */}
        {showCreateQuizModal && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-[9998]" 
              onClick={() => {
                setShowCreateQuizModal(false);
                setNewQuizName('');
              }}
            />
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Create New Quiz</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Quiz Name</label>
                <input
                  type="text"
                  value={newQuizName}
                  onChange={(e) => setNewQuizName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateQuiz();
                    }
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter quiz name..."
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateQuiz}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateQuizModal(false);
                    setNewQuizName('');
                  }}
                  className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {/* Add/Edit Entry Modal */}
        {showAddEntryModal && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-[9998]" 
              onClick={() => {
                setShowAddEntryModal(false);
                setEditingEntry(null);
                setEntryForm({
                  Team: '',
                  Word: '',
                  Pronunciation: '',
                  AlternativePronunciation: '',
                  WordOrigin: '',
                  Meaning: '',
                  WordInContext: ''
                });
              }}
            />
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                {editingEntry ? 'Edit Entry' : 'Add Entry'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Team *</label>
                  <input
                    type="text"
                    value={entryForm.Team}
                    onChange={(e) => setEntryForm({...entryForm, Team: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Team name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Word *</label>
                  <input
                    type="text"
                    value={entryForm.Word}
                    onChange={(e) => setEntryForm({...entryForm, Word: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Word"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pronunciation</label>
                  <input
                    type="text"
                    value={entryForm.Pronunciation}
                    onChange={(e) => setEntryForm({...entryForm, Pronunciation: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Pronunciation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Alternative Pronunciation</label>
                  <input
                    type="text"
                    value={entryForm.AlternativePronunciation}
                    onChange={(e) => setEntryForm({...entryForm, AlternativePronunciation: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Alternative pronunciation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Word Origin</label>
                  <input
                    type="text"
                    value={entryForm.WordOrigin}
                    onChange={(e) => setEntryForm({...entryForm, WordOrigin: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Word origin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Meaning</label>
                  <textarea
                    value={entryForm.Meaning}
                    onChange={(e) => setEntryForm({...entryForm, Meaning: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Meaning"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Word in Context</label>
                  <textarea
                    value={entryForm.WordInContext}
                    onChange={(e) => setEntryForm({...entryForm, WordInContext: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Word in context"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={editingEntry ? handleEditEntry : handleAddEntry}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {editingEntry ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowAddEntryModal(false);
                    setEditingEntry(null);
                    setEntryForm({
                      Team: '',
                      Word: '',
                      Pronunciation: '',
                      AlternativePronunciation: '',
                      WordOrigin: '',
                      Meaning: '',
                      WordInContext: ''
                    });
                  }}
                  className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
