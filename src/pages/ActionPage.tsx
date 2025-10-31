import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { parseExcelFile } from '../utils/excelParser';
import type { QuizRow } from '../utils/excelParser';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
import { soundManager } from '../utils/soundManager';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle row selection - just select, don't start
  const handleSelectRow = (index: number) => {
    // Toggle selection
    const newSelectedRows = selectedRows.includes(index)
      ? selectedRows.filter(i => i !== index)
      : [...selectedRows, index];
    
    setSelectedRows(newSelectedRows);
    
    // Get the last selected row's word to display in ManageScreen
    const lastSelectedIndex = newSelectedRows.length > 0 
      ? newSelectedRows[newSelectedRows.length - 1] 
      : -1;
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

  // Listen for control messages from ManageScreen
  useEffect(() => {
    const unsubscribe = broadcastManager.listen((message: QuizMessage) => {
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
                lastSpokenRef.current = -1; // Reset speech tracking when timer starts
                
                soundManager.playStartSound();
                
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
              
              soundManager.playPauseSound();
              
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
            setIsRunning(false);
            setIsPaused(false);
            setTimeLeft(60);
            setCurrentStudent('');
            setCurrentWord('');
            setStartedRow(null);
            
            soundManager.playEndSound();
            
            const endMessage: QuizMessage = {
              type: 'end',
              selectedEntries: selectedRows.map(i => ({
                word: quizData[i].Word,
                team: quizData[i].Team
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
    };
  }, [selectedRows, quizData, currentStudent, currentWord, isRunning, isPaused, timeLeft]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 's':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleStart();
          }
          break;
        case 'p':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handlePause();
          }
          break;
        case 'e':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleEnd();
          }
          break;
        case 'u':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            fileInputRef.current?.click();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
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

    try {
      const data = await parseExcelFile(file);
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

    // Play start sound
    soundManager.playStartSound();

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
    
    // Play pause sound
    soundManager.playPauseSound();
    
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
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(60);
    setCurrentStudent('');
    setCurrentWord('');
    setStartedRow(null);
    // Don't clear selectedRows - keep them for manage screen

    // Play end sound
    soundManager.playEndSound();

    // Broadcast end to view page and manage screen (with current selected entries)
    const message: QuizMessage = {
      type: 'end',
      selectedEntries: selectedRows.map(i => ({
        word: quizData[i].Word,
        team: quizData[i].Team
      }))
    };
    broadcastManager.send(message);
  };

  // Ref to track last spoken time
  const lastSpokenRef = useRef<number>(-1);
  
  // Timer interval - runs when timer is active
  useEffect(() => {
    let intervalId: number | null = null;
    
    const speakTime = (time: number) => {
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        speechSynthesis.cancel();
        
        // Wait a bit for cancel to take effect
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(time.toString());
          utterance.rate = 0.8;
          utterance.volume = 1.0; // Full volume
          utterance.pitch = 1.0;
          
          // Get voices - may need to load first
          const getVoices = () => {
            let voices = speechSynthesis.getVoices();
            if (voices.length === 0) {
              // Voices not loaded yet, wait for voiceschanged event
              return new Promise<SpeechSynthesisVoice[]>((resolve) => {
                const handler = () => {
                  voices = speechSynthesis.getVoices();
                  speechSynthesis.onvoiceschanged = null;
                  resolve(voices);
                };
                speechSynthesis.onvoiceschanged = handler;
                // Fallback timeout
                setTimeout(() => {
                  speechSynthesis.onvoiceschanged = null;
                  resolve([]);
                }, 1000);
              });
            }
            return Promise.resolve(voices);
          };
          
          getVoices().then((voices) => {
            const preferredVoice = voices.find(voice => 
              voice.lang.startsWith('en') && (voice.name.includes('Google') || voice.name.includes('Microsoft'))
            ) || voices.find(voice => voice.lang.startsWith('en'));
            
            if (preferredVoice) {
              utterance.voice = preferredVoice;
            }
            
            speechSynthesis.speak(utterance);
          });
        }, 50);
      }
    };
    
    if (isRunning && !isPaused) {
      intervalId = window.setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          
          if (newTime <= 0) {
            // Timer ended - update state and broadcast
            setIsRunning(false);
            setIsPaused(false);
            setStartedRow(null);
            
            // Broadcast end message with word included
            const endMessage: QuizMessage = {
              type: 'end',
              data: {
                student: '',
                word: currentWord,
                timeLeft: 0,
                isRunning: false
              },
              selectedEntries: selectedRows.map(i => ({
                word: quizData[i].Word,
                team: quizData[i].Team
              }))
            };
            broadcastManager.send(endMessage);
            
            return 0;
          }
          
          // Speech and sound announcements
          if (newTime === 50 || newTime === 40 || newTime === 30 || newTime === 20 || newTime === 10) {
            if (lastSpokenRef.current !== newTime) {
              speakTime(newTime);
              soundManager.playWarningSound();
              broadcastManager.sendSpeech(newTime, true);
              lastSpokenRef.current = newTime;
            }
          } else if (newTime <= 10 && newTime > 0 && lastSpokenRef.current !== newTime) {
            speakTime(newTime);
            soundManager.playTickSound();
            lastSpokenRef.current = newTime;
            broadcastManager.sendSpeech(newTime, true);
          }
          
          // Broadcast update with new time
          const updateMessage: QuizMessage = {
            type: 'update',
            data: {
              student: currentStudent,
              word: currentWord,
              timeLeft: newTime,
              isRunning: true
            },
            selectedEntries: selectedRows.map(i => ({
              word: quizData[i].Word,
              team: quizData[i].Team
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
      }
    };
  }, [isRunning, isPaused, selectedRows, quizData, currentStudent, currentWord]);

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
