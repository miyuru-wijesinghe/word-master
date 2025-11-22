import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { parseExcelFile } from '../utils/excelParser';
import type { QuizRow } from '../utils/excelParser';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
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

  // Handle row selection - single selection, don't start
  const handleSelectRow = (index: number) => {
    const isAlreadySelected = selectedRows.length === 1 && selectedRows[0] === index;
    
    // Only keep one selection at a time
    const newSelectedRows = isAlreadySelected ? [] : [index];
    
    setSelectedRows(newSelectedRows);
    
    // Get the last selected row's word to display in ManageScreen
    const lastSelectedIndex = newSelectedRows.length > 0 ? newSelectedRows[0] : -1;
    const lastRow = lastSelectedIndex >= 0 ? quizData[lastSelectedIndex] : null;

    // Broadcast selected entries and current word to manage screen
    // Include word in data for ManageScreen, but set isRunning to false so ViewPage ignores it
    const message: QuizMessage = {
      type: 'update',
      data: lastRow ? {
        student: '',
        word: lastRow.Word,
        timeLeft: 0,
        isRunning: false  // ViewPage will ignore this because isRunning is false
      } : undefined,
      selectedEntries: newSelectedRows.map(i => ({
        word: quizData[i].Word,
        team: quizData[i].Team
      }))
    };
    broadcastManager.send(message);
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
      // Handle judge results - show alert on control panel
      if (message.type === 'judge' && message.judgeData) {
        console.log('Control Panel: Received judge result:', message.judgeData);
        setJudgeResult({
          isCorrect: message.judgeData.isCorrect,
          actualWord: message.judgeData.actualWord,
          typedWord: message.judgeData.typedWord
        });
        setShowJudgeAlert(true);
        console.log('Control Panel: Alert should be visible now');
        
        // Clear previous timeout if exists
        if (judgeAlertTimeoutRef.current) {
          clearTimeout(judgeAlertTimeoutRef.current);
        }
        
        // Auto-hide alert after 8 seconds (increased for better visibility)
        judgeAlertTimeoutRef.current = window.setTimeout(() => {
          setShowJudgeAlert(false);
          setJudgeResult(null);
        }, 8000);
      }
      
      if (message.type === 'control' && message.control) {
        const { action, addSeconds } = message.control;
        
        switch (action) {
          case 'start':
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
                setTimeLeft(duration);
                setIsRunning(true);
                setIsPaused(false);
                lastBeepRef.current = -1; // Reset beep tracking when timer starts
                
                const startMessage: QuizMessage = {
                  type: 'update',
                  data: {
                    student: '',
                    word: selectedData.Word,
                    timeLeft: duration,
                    isRunning: true,
                    duration: duration
                  },
                  selectedEntries: currentSelected.map(i => ({
                    word: quizData[i].Word,
                    team: quizData[i].Team
                  }))
                };
                broadcastManager.send(startMessage);
              }
              return currentSelected;
            });
            break;
          case 'pause':
            setIsPaused(prevPaused => {
              const newPaused = !prevPaused;
              
              setCurrentStudent(prev => {
                setCurrentWord(prevWord => {
                  setTimeLeft(prevTime => {
                    const pauseMessage: QuizMessage = {
                      type: newPaused ? 'pause' : 'update',
                      data: {
                        student: prev,
                        word: prevWord,
                        timeLeft: prevTime,
                        isRunning: !newPaused
                      },
                      selectedEntries: selectedRows.map(i => ({
                        word: quizData[i].Word,
                        team: quizData[i].Team
                      }))
                    };
                    broadcastManager.send(pauseMessage);
                    return prevTime;
                  });
                  return prevWord;
                });
                return prev;
              });
              
              return newPaused;
            });
            break;
          case 'end':
            // Get current word before clearing it - use refs to ensure we get the latest value
            const wordToShow = currentWordRef.current || (startedRow !== null && quizDataRef.current[startedRow] ? quizDataRef.current[startedRow].Word : '');
            
            // Stop timer immediately - set states first
            setIsRunning(false);
            setIsPaused(false);
            setTimeLeft(60);
            setCurrentStudent('');
            setCurrentWord('');
            currentWordRef.current = ''; // Clear ref value too
            setStartedRow(null);
            
            // Broadcast end message with word included
            const endMessage: QuizMessage = {
              type: 'end',
              data: {
                student: '',
                word: wordToShow,
                timeLeft: 0,
                isRunning: false
              },
              selectedEntries: selectedRowsRef.current.map(i => ({
                word: quizDataRef.current[i].Word,
                team: quizDataRef.current[i].Team
              }))
            };
            broadcastManager.send(endMessage);
            break;
          case 'addTime':
            if (addSeconds && (isRunning || isPaused)) {
              const newTime = Math.min(timeLeft + addSeconds, 3600); // Max 1 hour
              setTimeLeft(newTime);
              
              // Broadcast updated time
              const updateMessage: QuizMessage = {
                type: 'update',
                data: {
                  student: currentStudent,
                  word: currentWord,
                  timeLeft: newTime,
                  isRunning: isRunning
                },
                selectedEntries: selectedRows.map(i => ({
                  word: quizData[i].Word,
                  team: quizData[i].Team
                }))
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
      button.textContent = 'Uploading...';
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
      
      setQuizData(data);
      setSelectedRows([]);
      setStartedRow(null);
      setIsRunning(false);
      setIsPaused(false);
      setTimeLeft(60);
      setCurrentStudent('');
      setCurrentWord('');
    } catch (error) {
      alert(`Error parsing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    setCurrentStudent(''); // No longer using student name
    setCurrentWord(selectedData.Word);
    setStartedRow(lastSelectedIndex);
    setTimeLeft(60);
    setIsRunning(true);
    setIsPaused(false);

    // Broadcast to view page and manage screen
    const message: QuizMessage = {
      type: 'update',
      data: {
        student: '',
        word: selectedData.Word,
        timeLeft: 60,
        isRunning: true
      },
      selectedEntries: selectedRows.map(i => ({
        word: quizData[i].Word,
        team: quizData[i].Team
      }))
    };
    broadcastManager.send(message);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    
    const message: QuizMessage = {
      type: isPaused ? 'update' : 'pause',
      data: {
        student: currentStudent,
        word: currentWord,
        timeLeft,
        isRunning: !isPaused
      },
      selectedEntries: selectedRows.map(i => ({
        word: quizData[i].Word,
        team: quizData[i].Team
      }))
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
    // Don't clear selectedRows - keep them for manage screen

    // Broadcast end to view page and manage screen (with current word and selected entries)
    const message: QuizMessage = {
      type: 'end',
      data: {
        student: '',
        word: wordToShow,
        timeLeft: 0,
        isRunning: false
      },
      selectedEntries: selectedRows.map(i => ({
        word: quizData[i].Word,
        team: quizData[i].Team
      }))
    };
    broadcastManager.send(message);
  };

  // Ref to track last beep time
  const lastBeepRef = useRef<number>(-1);
  
  // Refs to store current values for timer interval (prevents interval restart on state changes)
  const currentWordRef = useRef(currentWord);
  const currentStudentRef = useRef(currentStudent);
  const selectedRowsRef = useRef(selectedRows);
  const quizDataRef = useRef(quizData);
  const isRunningRef = useRef(isRunning);
  const isPausedRef = useRef(isPaused);

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

  // Timer interval - runs when timer is active
  useEffect(() => {
    let intervalId: number | null = null;
    
    if (isRunning && !isPaused) {
      intervalId = window.setInterval(() => {
        setTimeLeft(prev => {
          // Check if timer was stopped externally
          if (!isRunningRef.current || isPausedRef.current) {
            return prev;
          }

          const newTime = prev - 1;
          
          if (newTime <= 0) {
            // Timer ended - update state
            setIsRunning(false);
            setIsPaused(false);
            setStartedRow(null);
            
            // Broadcast end message with word included
            const endMessage: QuizMessage = {
              type: 'end',
              data: {
                student: '',
                word: currentWordRef.current,
                timeLeft: 0,
                isRunning: false
              },
              selectedEntries: selectedRowsRef.current.map(i => ({
                word: quizDataRef.current[i].Word,
                team: quizDataRef.current[i].Team
              }))
            };
            broadcastManager.send(endMessage);
            
            return 0;
          }
          
          // Beep sound announcements (handled on ViewPage)
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
          
          // Broadcast update with new time
          const updateMessage: QuizMessage = {
            type: 'update',
            data: {
              student: currentStudentRef.current,
              word: currentWordRef.current,
              timeLeft: newTime,
              isRunning: true
            },
            selectedEntries: selectedRowsRef.current.map(i => ({
              word: quizDataRef.current[i].Word,
              team: quizDataRef.current[i].Team
            }))
          };
          broadcastManager.send(updateMessage);
          
          return newTime;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [isRunning, isPaused]); // Only depend on isRunning and isPaused

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
                  {judgeResult.typedWord}
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

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              📁 Upload Excel
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
            accept=".xlsx"
            onChange={handleFileUpload}
            className="hidden"
          />

        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Spelling Challenge Roster</h2>
          <DataTable
            data={quizData}
            selectedRows={selectedRows}
            startedRow={startedRow}
            onSelectRow={handleSelectRow}
            onUpdateRow={handleUpdateRow}
          />
        </div>

      </div>
    </div>
  );
};
