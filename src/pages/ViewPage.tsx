import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
import { soundManager } from '../utils/soundManager';

const RESULT_DELAY_MS = 5000;
const RESULT_DISPLAY_MS = 15000;

export const ViewPage: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerEnded, setTimerEnded] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'timer' | 'video'>('timer');
  const [judgeResult, setJudgeResult] = useState<QuizMessage['judgeData'] | null>(null);
  const [pendingWord, setPendingWord] = useState('');
  const [isResultVisible, setIsResultVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastBeepRef = useRef<number>(-1);
  const resultDelayTimeoutRef = useRef<number | null>(null);
  const resultHideTimeoutRef = useRef<number | null>(null);

  const clearResultTimers = () => {
    if (resultDelayTimeoutRef.current !== null) {
      clearTimeout(resultDelayTimeoutRef.current);
      resultDelayTimeoutRef.current = null;
    }
    if (resultHideTimeoutRef.current !== null) {
      clearTimeout(resultHideTimeoutRef.current);
      resultHideTimeoutRef.current = null;
    }
  };

  const startResultWindow = (wordToShow?: string) => {
    clearResultTimers();
    if (wordToShow) {
      setPendingWord(wordToShow);
    }
    setTimerEnded(true);
    setIsRunning(false);
    setIsPaused(false);
    setIsResultVisible(false);

    resultDelayTimeoutRef.current = window.setTimeout(() => {
      setIsResultVisible(true);
      resultDelayTimeoutRef.current = null;

      resultHideTimeoutRef.current = window.setTimeout(() => {
        setIsResultVisible(false);
        setPendingWord('');
        setJudgeResult(null);
        setTimerEnded(false);
        resultHideTimeoutRef.current = null;
      }, RESULT_DISPLAY_MS);
    }, RESULT_DELAY_MS);
  };

  useEffect(() => {
    const cleanup = broadcastManager.listen((message: QuizMessage) => {
      switch (message.type) {
        case 'update':
          // Only update ViewPage if timer is actually running (isRunning === true)
          // Don't update on row selection - that's only for ManageScreen
          if (message.data && message.data.isRunning) {
            setTimeLeft(message.data.timeLeft);
            setIsRunning(message.data.isRunning);
            setIsPaused(!message.data.isRunning);
            setTimerEnded(false);
            setPendingWord('');
            setIsResultVisible(false);
            setJudgeResult(null);
            clearResultTimers();
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
          clearResultTimers();
          if (message.data && message.data.word) {
            soundManager.playTimerEndBeep();
            startResultWindow(message.data.word);
          } else {
            setTimerEnded(false);
            setIsResultVisible(false);
            setIsRunning(false);
            setIsPaused(false);
            setPendingWord('');
            setJudgeResult(null);
            setTimeLeft(60);
          }
          lastBeepRef.current = -1;
          break;
        case 'clear':
          clearResultTimers();
          setPendingWord('');
          setTimeLeft(60);
          setIsRunning(false);
          setIsPaused(false);
          setTimerEnded(false);
          setIsResultVisible(false);
          setVideoUrl('');
          setDisplayMode('timer');
          setJudgeResult(null);
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
                setIsResultVisible(false);
                // Don't clear word here - it might be from a timer that just ended
                // Only clear if it's a stop action
                if (message.videoData.action === 'stop') {
                  clearResultTimers();
                  setPendingWord('');
                  setIsRunning(false);
                  setIsPaused(false);
                  setTimeLeft(60);
                  setJudgeResult(null);
                }
              }
              
              // When switching to video mode, ensure timer states are cleared
              if (newMode === 'video') {
                clearResultTimers();
                setIsRunning(false);
                setIsPaused(false);
                setTimerEnded(false);
                setIsResultVisible(false);
                // Keep word cleared when switching to video
                setPendingWord('');
                setJudgeResult(null);
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
        case 'judge':
          if (message.judgeData) {
            setJudgeResult(message.judgeData);
            if (!pendingWord && message.judgeData.actualWord) {
              setPendingWord(message.judgeData.actualWord);
            }
            if (!timerEnded && !isResultVisible) {
              startResultWindow(message.judgeData.actualWord);
            }
            if (message.judgeData.isCorrect) {
              soundManager.playCorrectSound();
            } else {
              soundManager.playIncorrectSound();
            }
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
      clearResultTimers();
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
      const target = event.target as HTMLElement;
      
      // Allow default behavior when the user is focused in an input/textarea/select/contentEditable element
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return;
      }

      const isCharacterKey =
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey;

      if (event.repeat || isCharacterKey) {
        event.preventDefault();
        event.stopPropagation();
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
        ) : displayMode === 'timer' && timerEnded && !isResultVisible ? (
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
            🐝Get Set...The Next Word’s Coming!
            </p>
          </div>
        )}
      </div>
      {displayMode === 'timer' && isResultVisible && (
        <div className="px-8 pb-10">
          <div
            className={`max-w-4xl mx-auto rounded-3xl border-2 p-6 text-center ${
              judgeResult
                ? judgeResult.isCorrect
                  ? 'bg-green-900/40 border-green-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                  : 'bg-red-900/40 border-red-500 shadow-[0_0_30px_rgba(248,113,113,0.3)]'
                : 'bg-slate-900/40 border-white/10'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h3 className="text-3xl font-bold">Latest Result</h3>
              {judgeResult && (
                <span
                  className={`px-6 py-2 rounded-full text-xl font-semibold ${
                    judgeResult.isCorrect ? 'bg-green-500 text-slate-900' : 'bg-red-500 text-white'
                  }`}
                >
                  {judgeResult.isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              )}
            </div>
            <div className="grid gap-6 md:grid-cols-2 text-left">
              <div className="bg-slate-900/40 rounded-2xl p-5 border border-white/10">
                <p className="text-sm uppercase tracking-widest text-slate-400 mb-2">Correct Word</p>
                <p className="text-4xl font-bold break-words">
                  {pendingWord || judgeResult?.actualWord || ''}
                </p>
              </div>
              {judgeResult && (
                <div className="bg-slate-900/40 rounded-2xl p-5 border border-white/10">
                  <p className="text-sm uppercase tracking-widest text-slate-400 mb-2">Typed Word</p>
                  <p className="text-4xl font-bold break-words">
                    {judgeResult.typedWord || ''}
                  </p>
                </div>
              )}
            </div>
            <p className="mt-6 text-slate-300 text-lg">Result shared from Judge Console</p>
          </div>
        </div>
      )}
    </div>
  );
};
