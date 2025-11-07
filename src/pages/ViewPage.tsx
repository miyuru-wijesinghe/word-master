import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';

export const ViewPage: React.FC = () => {
  const [word, setWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerEnded, setTimerEnded] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'timer' | 'video'>('timer');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSpokenRef = useRef<number>(-1);

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
            const timeToSpeak = message.speechData.timeLeft;
            // Only speak if we haven't spoken this time yet
            if (lastSpokenRef.current !== timeToSpeak) {
              speakTime(timeToSpeak);
              lastSpokenRef.current = timeToSpeak;
            }
          }
          break;
        case 'pause':
          setIsPaused(true);
          setIsRunning(false);
          break;
        case 'end':
          // If word is provided in end message, timer ended naturally - show word
          // If no word in end message, End button was pressed - reset to default
          if (message.data && message.data.word) {
            // Timer ended naturally - show word
            setTimerEnded(true);
            setWord(message.data.word);
            setIsRunning(false);
            setIsPaused(false);
          } else {
            // End button was pressed - reset to default
            setTimerEnded(false);
            setIsRunning(false);
            setIsPaused(false);
            setWord('');
            setTimeLeft(60);
          }
          lastSpokenRef.current = -1;
          if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
          }
          break;
        case 'clear':
          setWord('');
          setTimeLeft(60);
          setIsRunning(false);
          setIsPaused(false);
          setTimerEnded(false);
          setVideoUrl('');
          setDisplayMode('timer');
          lastSpokenRef.current = -1;
          // Cancel any ongoing speech
          if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
          }
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
                // Don't clear word here - it might be from a timer that just ended
                // Only clear if it's a stop action
                if (message.videoData.action === 'stop') {
                  setWord('');
                  setIsRunning(false);
                  setIsPaused(false);
                  setTimeLeft(60);
                }
              }
              
              // When switching to video mode, ensure timer states are cleared
              if (newMode === 'video') {
                setIsRunning(false);
                setIsPaused(false);
                setTimerEnded(false);
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

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
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
        ) : displayMode === 'timer' && word && timerEnded ? (
          /* Show word ONLY after timer ends (timerEnded === true) */
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
