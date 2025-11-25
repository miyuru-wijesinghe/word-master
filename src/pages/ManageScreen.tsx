import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';

interface SelectedEntry {
  word: string;
  team: string;
}

export const ManageScreen: React.FC = () => {
  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [timerEnded, setTimerEnded] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null); // 30 or 120 seconds
  const [hasStarted, setHasStarted] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoObjectUrl, setVideoObjectUrl] = useState<string>('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [hasVideoPlayed, setHasVideoPlayed] = useState(false); // Track if video has been played at least once
  const [displayMode, setDisplayMode] = useState<'timer' | 'video'>('timer'); // Track which mode is active
  const [mediaType, setMediaType] = useState<'video' | 'image' | null>(null);
  const timerActiveRef = useRef(false);
  // Refs to track previous values and prevent unnecessary state updates
  const prevTimeLeftRef = useRef<number>(60);
  const prevIsRunningRef = useRef<boolean>(false);
  const prevIsPausedRef = useRef<boolean>(false);
  const prevWordRef = useRef<string>('');
  // Track if page has been initialized - prevents processing stale messages on mount
  const isInitializedRef = useRef<boolean>(false);
  const timerEndTimestampRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const stopLocalCountdown = () => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startLocalCountdown = () => {
    stopLocalCountdown();
    countdownIntervalRef.current = window.setInterval(() => {
      if (timerEndTimestampRef.current) {
        const nextTime = Math.max(0, Math.floor((timerEndTimestampRef.current - Date.now()) / 1000));
        setTimeLeft(nextTime);
        prevTimeLeftRef.current = nextTime;
        if (nextTime <= 0) {
          stopLocalCountdown();
          timerEndTimestampRef.current = null;
          setIsRunning(false);
          setIsPaused(false);
          setTimerEnded(true);
        }
      }
    }, 250);
  };

  useEffect(() => {
    return () => {
      stopLocalCountdown();
    };
  }, []);

  const resetAfterEnd = (options?: { keepWord?: boolean }) => {
    setTimerEnded(false);
    if (!options?.keepWord) {
      setCurrentWord('');
    }
    setHasStarted(false);
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(0);
    timerEndTimestampRef.current = null;
    stopLocalCountdown();
  };

  useEffect(() => {
    timerActiveRef.current = isRunning || isPaused;
  }, [isRunning, isPaused]);

  useEffect(() => {
    // Reset initialization flag on mount - clears any cached state
    isInitializedRef.current = false;
    
    // Reset all prev refs to clear cached values
    prevTimeLeftRef.current = 0;
    prevIsRunningRef.current = false;
    prevIsPausedRef.current = false;
    prevWordRef.current = '';
    
    // Mark as initialized after a delay to avoid processing stale messages on mount
    const initTimeout = setTimeout(() => {
      isInitializedRef.current = true;
      console.log('ManageScreen: Initialized, cache cleared, will now process messages');
    }, 500);
    
    // Listen for broadcast messages
    const unsubscribe = broadcastManager.listen((message: QuizMessage) => {
      if (message.selectedEntries) {
        setSelectedEntries(message.selectedEntries);
      }
      
      // Update timer state
      if (message.data) {
        const { timeLeft: incomingTime, isRunning: incomingRunning, word } = message.data;
        let computedTimeLeft = incomingTime;

        if (message.data.endsAt && incomingRunning) {
          timerEndTimestampRef.current = message.data.endsAt;
          computedTimeLeft = Math.max(0, Math.floor((message.data.endsAt - Date.now()) / 1000));
          startLocalCountdown();
        } else if (!incomingRunning) {
          timerEndTimestampRef.current = null;
          stopLocalCountdown();
        } else if (incomingRunning && !message.data.endsAt) {
          timerEndTimestampRef.current = Date.now() + incomingTime * 1000;
          startLocalCountdown();
        }

        const isSelectionUpdate = message.type === 'update' && !incomingRunning && computedTimeLeft === 0;

        // CRITICAL: Ignore word updates from stale messages before initialization
        // This prevents showing words like 'Astral' on initial load
        if (!isInitializedRef.current && word) {
          console.log('ManageScreen: Ignoring word from stale message before initialization:', word);
          // Don't set currentWord, but still process other updates
        } else if (isSelectionUpdate) {
          if (word && word !== prevWordRef.current) {
            setCurrentWord(word);
            prevWordRef.current = word;
          }
          
          if (!timerActiveRef.current) {
            setIsRunning(false);
            setIsPaused(false);
            setHasStarted(false);
            setTimerEnded(false);
            setTimeLeft(0);
            prevTimeLeftRef.current = 0;
            prevIsRunningRef.current = false;
            prevIsPausedRef.current = false;
          }
          
          // Selection updates shouldn't override an active timer
          if (timerActiveRef.current) {
            return;
          }
        }
        
        // Only update timeLeft if it actually changed - prevents unnecessary re-renders
        if (computedTimeLeft !== prevTimeLeftRef.current) {
          setTimeLeft(computedTimeLeft);
          prevTimeLeftRef.current = computedTimeLeft;
        }
        
        // Only update isRunning if it actually changed
        if (incomingRunning !== prevIsRunningRef.current) {
        setIsRunning(incomingRunning);
          prevIsRunningRef.current = incomingRunning;
        }
        
        // Only update word if it actually changed AND page is initialized
        if (word && word !== prevWordRef.current && isInitializedRef.current) {
          setCurrentWord(word);
          prevWordRef.current = word;
        }
        
        if (incomingRunning) {
          if (!prevIsPausedRef.current) {
          setIsPaused(false);
            prevIsPausedRef.current = false;
          }
          setTimerEnded(false);
          setHasStarted(true);
        } else if (incomingTime === 0) {
          // Not running and no countdown active
          if (prevIsPausedRef.current) {
          setIsPaused(false);
            prevIsPausedRef.current = false;
          }
          setHasStarted(false);
          if (!word) {
            setTimerEnded(false);
          }
        }
      }
      
      // Handle pause
      if (message.type === 'pause') {
        timerEndTimestampRef.current = null;
        stopLocalCountdown();
        if (!prevIsPausedRef.current) {
        setIsPaused(true);
          prevIsPausedRef.current = true;
        }
        if (prevIsRunningRef.current) {
        setIsRunning(false);
          prevIsRunningRef.current = false;
        }
      }
      
      // Handle end - differentiate between natural timer end and End button press
      if (message.type === 'end') {
        timerEndTimestampRef.current = null;
        stopLocalCountdown();
        if (prevIsRunningRef.current) {
        setIsRunning(false);
          prevIsRunningRef.current = false;
        }
        if (prevIsPausedRef.current) {
        setIsPaused(false);
          prevIsPausedRef.current = false;
        }
        if (prevTimeLeftRef.current !== 0) {
        setTimeLeft(0);
          prevTimeLeftRef.current = 0;
        }
        // If message has word data, timer ended naturally - show end screen
        if (message.data && message.data.word) {
          setTimerEnded(true);
          if (message.data.word !== prevWordRef.current) {
          setCurrentWord(message.data.word);
            prevWordRef.current = message.data.word;
          }
          setHasStarted(false);
        } else {
          // End was triggered - clear everything
          resetAfterEnd();
          prevTimeLeftRef.current = 0;
          prevIsRunningRef.current = false;
          prevIsPausedRef.current = false;
          prevWordRef.current = '';
        }
      }

      // Handle judge submissions that manually end the round
      if (message.type === 'judge' && message.judgeData) {
        if (timerActiveRef.current) {
          resetAfterEnd();
          timerEndTimestampRef.current = null;
          stopLocalCountdown();
        }
      }
    });

    return () => {
      clearTimeout(initTimeout);
      unsubscribe();
    };
  }, []);

  // Cleanup video URL on unmount
  useEffect(() => {
    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
    };
  }, [videoObjectUrl]);

  const handleStart = () => {
    // Ensure we're in timer mode
    setDisplayMode('timer');
    const duration = selectedDuration;
    if (!duration) {
      alert('Please select a time duration (30s or 2m) before starting');
      return;
    }
    
    // CRITICAL: Reset all timer-related state before starting
    // This ensures the timer starts fresh from the beginning, even after it has ended
    setTimerEnded(false);
    setIsPaused(false);
    setIsRunning(false); // Will be set to true by the control message
    setHasStarted(false); // Will be set to true by the control message
    setTimeLeft(duration);
    prevTimeLeftRef.current = duration;
    timerEndTimestampRef.current = Date.now() + duration * 1000;
    startLocalCountdown();
    
    // Broadcast mode change to timer
    broadcastManager.send({
      type: 'video',
      videoData: { 
        url: '', 
        isPlaying: false, 
        displayMode: 'timer',
        mediaType: mediaType || 'video'
      }
    });
    
    const message: QuizMessage = {
      type: 'control',
      control: {
        action: 'start',
        duration
      }
    };
    broadcastManager.send(message);
    // Optimistically update local timer state for immediate feedback
    setTimerEnded(false);
    setIsPaused(false);
    setIsRunning(true);
    setHasStarted(true);
    setTimeLeft(duration);
  };

  const handlePause = () => {
    if (!isRunning && !isPaused) {
      return;
    }
    
    const nextPaused = !isPaused;
    const safeWord = currentWord || '';
    const remainingSeconds = Math.max(0, timeLeft);
    const duration = selectedDuration ?? undefined;
    let resumeEndsAt: number | undefined;
    
    setIsPaused(nextPaused);
    setIsRunning(!nextPaused);
    setHasStarted(true);
    
    if (nextPaused) {
      timerEndTimestampRef.current = null;
      stopLocalCountdown();
      broadcastManager.send({
        type: 'pause',
        data: {
          student: '',
          word: safeWord,
          timeLeft: remainingSeconds,
          isRunning: false,
          duration
        }
      });
    } else {
      resumeEndsAt = Date.now() + remainingSeconds * 1000;
      timerEndTimestampRef.current = resumeEndsAt;
      startLocalCountdown();
      broadcastManager.send({
        type: 'update',
        data: {
          student: '',
          word: safeWord,
          timeLeft: remainingSeconds,
          isRunning: true,
          duration,
          endsAt: resumeEndsAt
        }
      });
    }
    
    const message: QuizMessage = {
      type: 'control',
      control: {
        action: 'pause'
      }
    };
    broadcastManager.send(message);
  };

  // handleEnd function removed - Clear button is commented out
  // If needed in the future, uncomment both the function and the button
  // const handleEnd = () => {
  //   console.log('ManageScreen: Clear button pressed');
  //   // Send clear message to reset view screen to default state
  //   const clearMessage: QuizMessage = {
  //     type: 'clear'
  //   };
  //   try {
  //     broadcastManager.send(clearMessage);
  //     console.log('ManageScreen: Clear message sent');
  //   } catch (error) {
  //     console.error('ManageScreen: Error sending clear message:', error);
  //   }
  //   // Also send control end message to stop timer
  //   const endMessage: QuizMessage = {
  //     type: 'control',
  //     control: {
  //       action: 'end'
  //     }
  //   };
  //   try {
  //     broadcastManager.send(endMessage);
  //     console.log('ManageScreen: Control end message sent');
  //   } catch (error) {
  //     console.error('ManageScreen: Error sending control end message:', error);
  //   }
  //   // Clear the end screen when Clear button is pressed
  //   resetAfterEnd();
  // };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft <= 10) return 'text-red-600';
    if (timeLeft <= 30) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-slate-900">Manage Screen</h1>
            <Link
              to="/"
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">Display Mode</h2>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setDisplayMode('timer');
                // Stop video if switching to timer and broadcast mode change
                // Always broadcast mode change, even if no video is loaded
                broadcastManager.send({
                  type: 'video',
                  videoData: { 
                    url: '', 
                    isPlaying: false, 
                    action: 'stop',
                    displayMode: 'timer',
                    mediaType: mediaType || 'video'
                  }
                });
                // Clear video state if switching to timer
                if (videoObjectUrl || videoUrl) {
                  setIsVideoPlaying(false);
                  setHasVideoPlayed(false);
                  setMediaType(null);
                  if (videoObjectUrl) {
                    URL.revokeObjectURL(videoObjectUrl);
                    setVideoObjectUrl('');
                  }
                  setVideoUrl('');
                }
              }}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                displayMode === 'timer'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ⏱️ Timer
            </button>
            <button
              onClick={() => {
                setDisplayMode('video');
                // Stop timer if switching to video
                if (isRunning || isPaused) {
                  broadcastManager.send({
                    type: 'control',
                    control: {
                      action: 'end'
                    }
                  });
                  resetAfterEnd();
                }
                // Always broadcast mode change to video, even if no video is loaded yet
                broadcastManager.send({
                  type: 'video',
                  videoData: { 
                    url: videoObjectUrl || videoUrl || '', 
                    isPlaying: false, 
                    displayMode: 'video',
                    mediaType: mediaType || 'video'
                  }
                });
              }}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                displayMode === 'video'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🎬 Video
            </button>
          </div>
        </div>

        {/* Video Control Section */}
        {displayMode === 'video' && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Video & Image Control</h2>
            
            {/* Video Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Media File (Video or Image)
              </label>
              <input
                type="file"
                accept="video/*,image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const objectUrl = URL.createObjectURL(file);
                    const detectedType: 'video' | 'image' = file.type.startsWith('image/')
                      ? 'image'
                      : 'video';
                    setVideoObjectUrl(objectUrl);
                    setVideoUrl(objectUrl);
                    setIsVideoPlaying(false);
                    setHasVideoPlayed(false);
                    setMediaType(detectedType);
                    // Broadcast video loaded
                    broadcastManager.send({
                      type: 'video',
                      videoData: { 
                        url: objectUrl, 
                        isPlaying: false,
                        displayMode: 'video',
                        mediaType: detectedType
                      }
                    });
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {/* Video Player Controls */}
            {(videoUrl || videoObjectUrl) && (
              <div className="text-center">
                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    onClick={() => {
                      // CRITICAL: Ensure we're in video mode before playing
                      // This is especially important when in timer mode after a word ends
                      if (displayMode !== 'video') {
                        setDisplayMode('video');
                      }
                      
                      if (!isVideoPlaying) {
                        setIsVideoPlaying(true);
                        setHasVideoPlayed(true);
                        // Ensure we have a video URL before sending play
                        const urlToSend = videoObjectUrl || videoUrl;
                        if (!urlToSend) {
                          console.warn('ManageScreen: No video URL available for play');
                          return;
                        }
                        broadcastManager.send({
                          type: 'video',
                          videoData: { 
                            url: urlToSend, 
                            isPlaying: true, 
                            action: 'play',
                            displayMode: 'video',
                            mediaType: mediaType || 'video'
                          }
                        });
                      } else {
                        setIsVideoPlaying(false);
                        broadcastManager.send({
                          type: 'video',
                          videoData: { 
                            url: videoObjectUrl || videoUrl, 
                            isPlaying: false, 
                            action: 'pause',
                            displayMode: 'video',
                            mediaType: mediaType || 'video'
                          }
                        });
                      }
                    }}
                    disabled={!videoObjectUrl && !videoUrl}
                    className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                      !videoObjectUrl && !videoUrl
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : isVideoPlaying
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white hover:scale-110 shadow-xl hover:shadow-2xl'
                        : 'bg-green-600 hover:bg-green-700 text-white hover:scale-110 shadow-xl hover:shadow-2xl'
                    }`}
                  >
                    {isVideoPlaying ? '⏸️ Pause' : hasVideoPlayed ? '▶️ Resume' : '▶️ Play'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsVideoPlaying(false);
                      setHasVideoPlayed(false);
                      setVideoUrl('');
                      setMediaType(null);
                      if (videoObjectUrl) {
                        URL.revokeObjectURL(videoObjectUrl);
                        setVideoObjectUrl('');
                      }
                      broadcastManager.send({
                        type: 'video',
                        videoData: { 
                          url: '', 
                          isPlaying: false, 
                          action: 'stop',
                          displayMode: 'timer',
                          mediaType: mediaType || 'video'
                        }
                      });
                    }}
                    className="px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 transform bg-red-600 hover:bg-red-700 text-white hover:scale-110 shadow-xl hover:shadow-2xl"
                  >
                    ⏹️ Stop
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Timer Control Section */}
        {displayMode === 'timer' && (
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Timer Control</h2>
          
          {/* Time Selection - Must select before starting */}
          {!hasStarted && selectedEntries.length > 0 && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <h3 className="text-xl font-semibold text-blue-900 mb-4 text-center">Select Time Duration</h3>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setSelectedDuration(30)}
                  className={`px-10 py-5 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                    selectedDuration === 30
                      ? 'bg-blue-600 text-white shadow-xl scale-105 ring-4 ring-blue-300'
                      : 'bg-white border-3 border-blue-500 text-blue-600 hover:bg-blue-50 hover:scale-105 hover:shadow-lg'
                  }`}
                >
                  30 Seconds
                </button>
                <button
                  onClick={() => setSelectedDuration(120)}
                  className={`px-10 py-5 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                    selectedDuration === 120
                      ? 'bg-blue-600 text-white shadow-xl scale-105 ring-4 ring-blue-300'
                      : 'bg-white border-3 border-blue-500 text-blue-600 hover:bg-blue-50 hover:scale-105 hover:shadow-lg'
                  }`}
                >
                  2 Minutes
                </button>
              </div>
            </div>
          )}
          
          {/* Selected Word Display - Show when selected but not started */}
          {currentWord && !timerEnded && !hasStarted && (
            <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 text-center">
              <h3 className="text-lg font-semibold text-green-800 mb-3">Selected Word</h3>
              <p className="text-4xl font-bold text-green-700">{currentWord}</p>
            </div>
          )}
          
          {/* Timer Display - Show countdown when running or paused */}
          {!timerEnded && (isRunning || isPaused || hasStarted) && (
            <div className="text-center mb-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
              <div className={`text-9xl font-bold ${getTimerColor()} mb-4 drop-shadow-lg`}>
                {formatTime(timeLeft)}
              </div>
              <div className="text-xl font-semibold text-gray-700">
                {isPaused ? '⏸️ Paused' : isRunning ? '▶️ Running' : 'Ready'}
              </div>
            </div>
          )}
          
          {/* Control Buttons - Always visible with better spacing */}
          <div className="text-center">
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={handleStart}
                disabled={isRunning || !selectedDuration || selectedEntries.length === 0}
                className={`px-10 py-5 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                  isRunning || !selectedDuration || selectedEntries.length === 0
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white hover:scale-110 shadow-xl hover:shadow-2xl'
                }`}
              >
                {timerEnded ? '🔄 Restart' : '▶️ Play'}
              </button>
              
              <button
                onClick={handlePause}
                disabled={!isRunning && !isPaused}
                className={`px-10 py-5 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                  !isRunning && !isPaused
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white hover:scale-110 shadow-xl hover:shadow-2xl'
                }`}
              >
                {isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </button>
              
              {/* <button
                onClick={handleEnd}
                className="px-10 py-5 rounded-xl font-bold text-lg transition-all duration-200 transform bg-red-600 hover:bg-red-700 text-white hover:scale-110 shadow-xl hover:shadow-2xl"
              >
                ⏹️ Clear
              </button> */}
            </div>
          </div>
          
          {/* Timer Ended Display */}
          {timerEnded && currentWord && (
            <div className="mt-8 text-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <div className="text-7xl font-bold text-blue-600 mb-4 drop-shadow-lg">
                {currentWord}
              </div>
              <div className="text-xl font-semibold text-gray-600">
                Timer Ended
              </div>
            </div>
          )}
          
          {/* Empty State */}
          {!currentWord && selectedEntries.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">⏱️</div>
              <p className="text-xl font-medium">Please select entries from Control Panel first</p>
            </div>
          )}
        </div>
        )}

        {/* Selected Entries Table */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Selected Entries ({selectedEntries.length} selected)
          </h2>
          
          {selectedEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No entries selected yet. Please select entries from the Control Panel.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Word
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedEntries.map((entry, index) => (
                    <tr 
                      key={index} 
                      className="hover:bg-gray-50 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {entry.word}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.team}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

