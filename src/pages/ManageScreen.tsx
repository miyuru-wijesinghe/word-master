import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
import { soundManager } from '../utils/soundManager';

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

  useEffect(() => {
    // Listen for broadcast messages
    const unsubscribe = broadcastManager.listen((message: QuizMessage) => {
      if (message.selectedEntries) {
        setSelectedEntries(message.selectedEntries);
      }
      
      // Update timer state
      if (message.data) {
        setTimeLeft(message.data.timeLeft);
        setIsRunning(message.data.isRunning);
        setIsPaused(false);
        if (message.data.word) {
          setCurrentWord(message.data.word);
        }
        // If timeLeft is 0 and not running, it's just showing the word for selection
        if (message.data.timeLeft === 0 && !message.data.isRunning) {
          // Just update word, don't set timer as ended
          setTimerEnded(false);
          setHasStarted(false);
        } else if (message.data.timeLeft === 0 && message.data.isRunning === false) {
          // Timer actually ended
          setTimerEnded(true);
          setHasStarted(false);
        } else if (message.data.timeLeft > 0 && message.data.isRunning) {
          // Reset timerEnded if timer restarts
          setTimerEnded(false);
          setHasStarted(true);
        }
      }
      
      // Handle pause
      if (message.type === 'pause') {
        setIsPaused(true);
        setIsRunning(message.data?.isRunning || false);
      }
      
      // Handle end - differentiate between natural timer end and End button press
      if (message.type === 'end') {
        setIsRunning(false);
        setIsPaused(false);
        // If message has word data, timer ended naturally - show end screen
        // If no word data, End button was pressed - already handled in handleEnd
        if (message.data && message.data.word) {
          setTimerEnded(true);
          setCurrentWord(message.data.word);
          setHasStarted(false);
        } else {
          // End button was pressed - clear everything (already handled in handleEnd)
          setTimerEnded(false);
          setCurrentWord('');
          setHasStarted(false);
          setSelectedDuration(null);
        }
      }
    });

    return () => {
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
    if (!selectedDuration) {
      alert('Please select a time duration (30s or 2m) before starting');
      return;
    }
    
    const message: QuizMessage = {
      type: 'control',
      control: {
        action: 'start',
        duration: selectedDuration
      }
    };
    broadcastManager.send(message);
    soundManager.playStartSound();
    setHasStarted(true);
  };

  const handlePause = () => {
    const message: QuizMessage = {
      type: 'control',
      control: {
        action: 'pause'
      }
    };
    broadcastManager.send(message);
    soundManager.playPauseSound();
  };

  const handleEnd = () => {
    const message: QuizMessage = {
      type: 'control',
      control: {
        action: 'end'
      }
    };
    broadcastManager.send(message);
    soundManager.playEndSound();
    // Clear the end screen when End button is pressed
    setTimerEnded(false);
    setCurrentWord('');
    setHasStarted(false);
    setSelectedDuration(null);
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(60);
  };

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
                // Stop video if switching to timer
                if (videoObjectUrl || videoUrl) {
                  broadcastManager.send({
                    type: 'video',
                    videoData: { url: '', isPlaying: false, action: 'stop' }
                  });
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
                  handleEnd();
                }
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
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Video Control</h2>
            
            {/* Video Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Video File
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const objectUrl = URL.createObjectURL(file);
                    setVideoObjectUrl(objectUrl);
                    setVideoUrl(objectUrl);
                    setIsVideoPlaying(false);
                    setHasVideoPlayed(false);
                    // Broadcast video loaded
                    broadcastManager.send({
                      type: 'video',
                      videoData: { url: objectUrl, isPlaying: false }
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
                      if (!isVideoPlaying) {
                        setIsVideoPlaying(true);
                        setHasVideoPlayed(true);
                        broadcastManager.send({
                          type: 'video',
                          videoData: { 
                            url: videoObjectUrl || videoUrl, 
                            isPlaying: true, 
                            action: 'play' 
                          }
                        });
                      } else {
                        setIsVideoPlaying(false);
                        broadcastManager.send({
                          type: 'video',
                          videoData: { 
                            url: videoObjectUrl || videoUrl, 
                            isPlaying: false, 
                            action: 'pause' 
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
                      if (videoObjectUrl) {
                        URL.revokeObjectURL(videoObjectUrl);
                        setVideoObjectUrl('');
                      }
                      broadcastManager.send({
                        type: 'video',
                        videoData: { url: '', isPlaying: false, action: 'stop' }
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
                ▶️ Play
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
              
              <button
                onClick={handleEnd}
                disabled={!isRunning && !isPaused && !hasStarted && !timerEnded}
                className={`px-10 py-5 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                  !isRunning && !isPaused && !hasStarted && !timerEnded
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white hover:scale-110 shadow-xl hover:shadow-2xl'
                }`}
              >
                ⏹️ End
              </button>
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

