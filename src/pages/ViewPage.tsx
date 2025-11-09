import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
import { soundManager } from '../utils/soundManager';

export const ViewPage: React.FC = () => {
  const [word, setWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerEnded, setTimerEnded] = useState(false);
  const [showWord, setShowWord] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'timer' | 'video'>('timer');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastBeepRef = useRef<number>(-1);
  const wordTimeoutRef = useRef<number | null>(null);
  const hideWordTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const cleanup = broadcastManager.listen((message: QuizMessage) => {
      switch (message.type) {
        case 'update':
          // Only update ViewPage if timer is actually running (isRunning === true)
          // Don't update on row selection - that's only for ManageScreen
          if (message.data && message.data.isRunning) {
            // Store word but don't display - only display after timer ends
            setWord(message.data.word);
            setTimeLeft(message.data.timeLeft);
            setIsRunning(message.data.isRunning);
            setIsPaused(!message.data.isRunning);
            // NEVER show word during countdown or selection - only after timer ends
            // timerEnded is only set to true when 'end' message is received
            setTimerEnded(false);
          }
          // If message.data.isRunning is false or missing, ignore it (row selection)
          break;
        case 'speech':
          if (message.speechData && message.speechData.shouldSpeak) {
            const timeToBeep = message.speechData.timeLeft;
            // Only beep if we haven't beeped this time yet
            if (lastBeepRef.current !== timeToBeep) {
              soundManager.playCountdownBeep();
              lastBeepRef.current = timeToBeep;
            }
          }
          break;
        case 'pause':
          setIsPaused(true);
          setIsRunning(false);
          break;
        case 'end':
          // Clear any existing timeouts
          if (wordTimeoutRef.current !== null) {
            clearTimeout(wordTimeoutRef.current);
            wordTimeoutRef.current = null;
          }
          if (hideWordTimeoutRef.current !== null) {
            clearTimeout(hideWordTimeoutRef.current);
            hideWordTimeoutRef.current = null;
          }
          
          // If word is provided in end message, show word after delay (same process for natural end or End button)
          // If no word in end message, reset to default
          if (message.data && message.data.word) {
            // Timer ended (naturally or via End button) - play beep and show word
            soundManager.playTimerEndBeep();
            setTimerEnded(true);
            setWord(message.data.word);
            setIsRunning(false);
            setIsPaused(false);
            setShowWord(false); // Don't show word immediately
            
            // Wait 5 seconds before showing the word
            wordTimeoutRef.current = window.setTimeout(() => {
              setShowWord(true);
              wordTimeoutRef.current = null;
              
              // After showing word, wait 8 seconds then hide it
              hideWordTimeoutRef.current = window.setTimeout(() => {
                setShowWord(false);
                setWord('');
                setTimerEnded(false);
                hideWordTimeoutRef.current = null;
              }, 8000);
            }, 5000);
          } else {
            // End button was pressed - reset to default
            setTimerEnded(false);
            setShowWord(false);
            setIsRunning(false);
            setIsPaused(false);
            setWord('');
            setTimeLeft(60);
          }
          lastBeepRef.current = -1;
          break;
        case 'clear':
          // Clear any existing timeouts
          if (wordTimeoutRef.current !== null) {
            clearTimeout(wordTimeoutRef.current);
            wordTimeoutRef.current = null;
          }
          if (hideWordTimeoutRef.current !== null) {
            clearTimeout(hideWordTimeoutRef.current);
            hideWordTimeoutRef.current = null;
          }
          setWord('');
          setTimeLeft(60);
          setIsRunning(false);
          setIsPaused(false);
          setTimerEnded(false);
          setShowWord(false);
          setVideoUrl('');
          setDisplayMode('timer');
          lastBeepRef.current = -1;
          break;
        case 'video':
          if (message.videoData) {
            // Update display mode if provided - this should happen first
            if (message.videoData.displayMode) {
              const newMode = message.videoData.displayMode;
              setDisplayMode(newMode);
              
              // When switching to timer mode, clear timer-related states if no timer is running
              if (newMode === 'timer') {
                // When switching to timer mode, clear word unless timer just ended
                // Timer running state will be updated by 'update' messages
                setTimerEnded(false);
                setShowWord(false);
                // Don't clear word here - it might be from a timer that just ended
                // Only clear if it's a stop action
                if (message.videoData.action === 'stop') {
                  // Clear any existing timeouts
                  if (wordTimeoutRef.current !== null) {
                    clearTimeout(wordTimeoutRef.current);
                    wordTimeoutRef.current = null;
                  }
                  if (hideWordTimeoutRef.current !== null) {
                    clearTimeout(hideWordTimeoutRef.current);
                    hideWordTimeoutRef.current = null;
                  }
                  setWord('');
                  setIsRunning(false);
                  setIsPaused(false);
                  setTimeLeft(60);
                }
              }
              
              // When switching to video mode, ensure timer states are cleared
              if (newMode === 'video') {
                // Clear any existing timeouts
                if (wordTimeoutRef.current !== null) {
                  clearTimeout(wordTimeoutRef.current);
                  wordTimeoutRef.current = null;
                }
                if (hideWordTimeoutRef.current !== null) {
                  clearTimeout(hideWordTimeoutRef.current);
                  hideWordTimeoutRef.current = null;
                }
                setIsRunning(false);
                setIsPaused(false);
                setTimerEnded(false);
                setShowWord(false);
                // Keep word cleared when switching to video
                setWord('');
              }
            }
            
            // Update video URL
            if (message.videoData.url !== undefined) {
              setVideoUrl(message.videoData.url || '');
            }
            
            // Control video playback - use setTimeout to ensure DOM is updated
            setTimeout(() => {
              const video = videoRef.current;
              if (!video) return;
              
              if (message.videoData?.action === 'play') {
                // Ensure video source is set
                const urlToPlay = message.videoData.url || videoUrl;
                if (urlToPlay && video.src !== urlToPlay) {
                  video.src = urlToPlay;
                  video.load();
                }
                // Wait for video to be ready before playing
                if (video.readyState >= 2) {
                  video.play().catch(console.error);
                } else {
                  const playWhenReady = () => {
                    video.play().catch(console.error);
                  };
                  video.addEventListener('loadeddata', playWhenReady, { once: true });
                  video.load();
                }
              } else if (message.videoData?.action === 'pause') {
                video.pause();
              } else if (message.videoData?.action === 'stop') {
                video.pause();
                video.currentTime = 0;
                if (video.src) {
                  video.src = '';
                }
                setVideoUrl('');
                // displayMode is already set from message.videoData.displayMode above
              }
            }, 0);
          }
          break;
      }
    });

    return cleanup;
  }, []);

  // Handle video URL changes and ensure video element is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || displayMode !== 'video' || !videoUrl) return;

    // Ensure video source is set when URL changes
    if (video.src !== videoUrl) {
      video.src = videoUrl;
      video.load();
    }
  }, [videoUrl, displayMode]);

  // Handle video end event - automatically close video screen when video ends
  useEffect(() => {
    const video = videoRef.current;
    if (!video || displayMode !== 'video') return;

    const handleVideoEnd = () => {
      // Clear video URL and reset display mode to timer
      setVideoUrl('');
      setDisplayMode('timer');
      // Reset video to beginning
      if (video) {
        video.currentTime = 0;
        if (video.src) {
          video.src = '';
        }
      }
      // Broadcast the mode change
      broadcastManager.send({
        type: 'video',
        videoData: { 
          url: '', 
          isPlaying: false, 
          action: 'stop',
          displayMode: 'timer'
        }
      });
    };

    video.addEventListener('ended', handleVideoEnd);

    return () => {
      video.removeEventListener('ended', handleVideoEnd);
    };
  }, [videoUrl, displayMode]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (wordTimeoutRef.current !== null) {
        clearTimeout(wordTimeoutRef.current);
      }
      if (hideWordTimeoutRef.current !== null) {
        clearTimeout(hideWordTimeoutRef.current);
      }
    };
  }, []);


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft <= 10) return 'text-red-500';
    if (timeLeft <= 30) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusColor = () => {
    if (isPaused) return 'text-yellow-500';
    if (isRunning) return 'text-green-500';
    return 'text-gray-500';
  };

  // Prevent unwanted keyboard input on ViewPage
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only prevent default for keys that might cause issues
      // Allow normal typing in any input fields
      const target = event.target as HTMLElement;
      
      // If user is typing in an input field, allow it
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return;
      }
      
      // Prevent key repeat events from causing issues
      if (event.repeat) {
        // Only prevent if it's a problematic key
        if (event.key === 'd' || event.key === 'D') {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col" tabIndex={-1}>
      {/* Header */}
      <div className="bg-slate-800 py-4 px-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">APIIT SPELL BEE</h1>
          <Link
            to="/"
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        {/* Show video if in video mode - fullscreen without controls */}
        {displayMode === 'video' && videoUrl ? (
          <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              playsInline
              key={videoUrl}
              tabIndex={-1}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : displayMode === 'video' && !videoUrl ? (
          <div className="text-center">
            <div className="text-8xl mb-8">🎬</div>
            <h2 className="text-6xl font-bold text-slate-400 mb-4">Waiting for Video</h2>
            <p className="text-3xl text-slate-500">
              Select a video in Manage Screen
            </p>
          </div>
        ) : displayMode === 'timer' && word && timerEnded && showWord ? (
          /* Show word ONLY after timer ends AND after 5 second delay */
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-16">
              <h2 className="text-5xl font-bold text-green-400 mb-6">Word</h2>
              <div className="text-7xl font-bold text-white bg-green-600 px-12 py-8 rounded-2xl shadow-2xl">
                {word}
              </div>
              <div className="mt-8 text-3xl font-semibold text-slate-400">
                Timer Ended
              </div>
            </div>
          </div>
        ) : displayMode === 'timer' && timerEnded && !showWord ? (
          /* Show waiting message during 5 second delay after timer ends */
          <div className="text-center">
            <div className="text-8xl mb-8">⏳</div>
            <h2 className="text-6xl font-bold text-slate-400 mb-4">Timer Ended</h2>
            <p className="text-3xl text-slate-500">
              Word will appear shortly...
            </p>
          </div>
        ) : displayMode === 'timer' && (isRunning || isPaused) ? (
          /* Show ONLY timer when running or paused - word is always hidden during countdown */
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8">
              <h2 className="text-5xl font-bold text-purple-400 mb-6">Time Left</h2>
              <div className={`text-8xl font-bold ${getTimerColor()} bg-slate-800 px-12 py-8 rounded-2xl shadow-2xl`}>
                {formatTime(timeLeft)}
              </div>
            </div>

            {/* Status */}
            <div className="text-3xl font-semibold">
              <span className={getStatusColor()}>
                {isPaused ? '⏸️ PAUSED' : isRunning ? '▶️ RUNNING' : '⏹️ STOPPED'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-8xl mb-8">🎯</div>
            <h2 className="text-6xl font-bold text-slate-400 mb-4">Waiting for the Word</h2>
            <p className="text-3xl text-slate-500">
              Ready for the next challenge
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
