import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
import { soundManager } from '../utils/soundManager';

const RESULT_DELAY_MS = 5000;
const RESULT_DISPLAY_MS = 10000;
const STALE_MESSAGE_MAX_MS = 15000;

export const ViewPage: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerEnded, setTimerEnded] = useState(false);
  const [hasActiveTimer, setHasActiveTimer] = useState(false); // Track if timer is active to prevent loading message flash
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'timer' | 'video'>('timer');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [isImageVisible, setIsImageVisible] = useState(false);
  const [judgeResult, setJudgeResult] = useState<QuizMessage['judgeData'] | null>(null);
  const [pendingWord, setPendingWord] = useState('');
  const [isResultVisible, setIsResultVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastBeepRef = useRef<number>(-1);
  const resultDelayTimeoutRef = useRef<number | null>(null);
  const resultHideTimeoutRef = useRef<number | null>(null);
  const mediaTypeRef = useRef<'video' | 'image'>('video');
  const wasRunningRef = useRef<boolean>(false);
  const judgeResultRef = useRef<QuizMessage['judgeData'] | null>(null);
  // Track if we're expecting a judge result - prevents control 'end' from clearing it
  const pendingJudgeResultRef = useRef<boolean>(false);
  const isExpectingJudgeRef = useRef<boolean>(false);
  // Track if page has been initialized - prevents processing stale messages on mount
  const isInitializedRef = useRef<boolean>(false);
  const timerEndTimestampRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(-1); // Track last time update to prevent excessive re-renders
  // Track display state in ref to prevent flashing during state transitions
  const shouldShowTimerRef = useRef<boolean>(false);
  const shouldShowResultRef = useRef<boolean>(false);
  // Track if start beep has been played for current timer session to prevent double beep
  const startBeepPlayedRef = useRef<boolean>(false);

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

  const stopCountdown = () => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    lastUpdateTimeRef.current = -1; // Reset when stopping countdown
  };

  const startCountdown = () => {
    stopCountdown();
    lastUpdateTimeRef.current = -1; // Reset when starting new countdown
    countdownIntervalRef.current = window.setInterval(() => {
      if (timerEndTimestampRef.current && !pendingJudgeResultRef.current) {
        const nextTime = Math.max(0, Math.floor((timerEndTimestampRef.current - Date.now()) / 1000));
        
        // CRITICAL: Only update state when time actually changes to prevent excessive re-renders
        // This prevents freezing by reducing state updates from 4 per second to 1 per second
        if (nextTime !== lastUpdateTimeRef.current) {
          // Direct state update - React will batch if needed
          setTimeLeft(nextTime);
          lastUpdateTimeRef.current = nextTime;
          
          // Play countdown beep for last 10 seconds (non-blocking)
          if (nextTime <= 10 && nextTime > 0) {
            if (lastBeepRef.current !== nextTime) {
              setTimeout(() => {
                try {
                  soundManager.ensureAudioContext();
                  soundManager.playCountdownBeep();
                } catch (e) {
                  console.warn('Beep error:', e);
                }
              }, 0);
              lastBeepRef.current = nextTime;
            }
          } else if (nextTime === 50 || nextTime === 40 || nextTime === 30 || nextTime === 20 || nextTime === 10) {
            // Beep at specific milestones (non-blocking)
            if (lastBeepRef.current !== nextTime) {
              setTimeout(() => {
                try {
                  soundManager.ensureAudioContext();
                  soundManager.playCountdownBeep();
                } catch (e) {
                  console.warn('Beep error:', e);
                }
              }, 0);
              lastBeepRef.current = nextTime;
            }
          }
        }
        
        if (nextTime <= 0) {
          stopCountdown();
          timerEndTimestampRef.current = null;
        }
      }
    }, 250);
  };

  const startResultWindow = (wordToShow?: string, immediate: boolean = false, preserveJudgeResult: boolean = false) => {
    clearResultTimers();
    stopCountdown();
    timerEndTimestampRef.current = null;
    isExpectingJudgeRef.current = false;
    
    // CRITICAL: Only set timerEnded if there's actually a word to show
    // This prevents "Timer Ended" screen from appearing when there's no word
    if (!wordToShow || wordToShow.trim() === '') {
      console.log('ViewPage: startResultWindow called without word, resetting timerEnded');
      shouldShowTimerRef.current = false;
      shouldShowResultRef.current = false;
      setTimerEnded(false);
      setIsResultVisible(false);
      setIsRunning(false);
      setIsPaused(false);
      return;
    }
    
    // CRITICAL: Update display refs FIRST to prevent flashing
    shouldShowTimerRef.current = false;
    shouldShowResultRef.current = true;
    
    setPendingWord(wordToShow);
    setTimerEnded(true);
    setIsRunning(false);
    setIsPaused(false);

    if (immediate) {
      // Show immediately - no delay
      setIsResultVisible(true);
      console.log('Result window shown immediately, preserveJudgeResult:', preserveJudgeResult);

      resultHideTimeoutRef.current = window.setTimeout(() => {
        soundManager.ensureAudioContext();
        soundManager.playWordClearBeep();
        // CRITICAL: Reset all timer-related state when result hides to prevent timer from reappearing
        shouldShowResultRef.current = false;
        shouldShowTimerRef.current = false;
        setIsResultVisible(false);
        setPendingWord('');
        setIsRunning(false);
        setIsPaused(false);
        setHasActiveTimer(false);
        setTimerEnded(false);
        setTimeLeft(60); // Reset to default
        if (!preserveJudgeResult) {
        setJudgeResult(null);
          judgeResultRef.current = null;
          pendingJudgeResultRef.current = false; // Reset pending flag
        }
        resultHideTimeoutRef.current = null;
      }, RESULT_DISPLAY_MS);
    } else {
      // Normal flow with delay
      setIsResultVisible(false);
      console.log('Starting result window delay, preserveJudgeResult:', preserveJudgeResult, 'wordToShow:', wordToShow);
      resultDelayTimeoutRef.current = window.setTimeout(() => {
        console.log('Result delay timeout fired, showing result now');
        setIsResultVisible(true);
        resultDelayTimeoutRef.current = null;

        resultHideTimeoutRef.current = window.setTimeout(() => {
          soundManager.ensureAudioContext();
          soundManager.playWordClearBeep();
          // CRITICAL: Reset all timer-related state when result hides to prevent timer from reappearing
          shouldShowResultRef.current = false;
          shouldShowTimerRef.current = false;
          setIsResultVisible(false);
          setPendingWord('');
          setIsRunning(false);
          setIsPaused(false);
          setHasActiveTimer(false);
          setTimerEnded(false);
          setTimeLeft(60); // Reset to default
          if (!preserveJudgeResult) {
            setJudgeResult(null);
            judgeResultRef.current = null;
            pendingJudgeResultRef.current = false; // Reset pending flag
          }
        resultHideTimeoutRef.current = null;
      }, RESULT_DISPLAY_MS);
    }, RESULT_DELAY_MS);
    }
  };

  useEffect(() => {
    mediaTypeRef.current = mediaType;
  }, [mediaType]);

  // Initialize audio context on view page load and on user interaction
  useEffect(() => {
    soundManager.ensureAudioContext();
    // Also try to initialize on any user interaction
    const handleInteraction = () => {
      soundManager.ensureAudioContext();
    };
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    judgeResultRef.current = judgeResult;
  }, [judgeResult]);

  useEffect(() => {
    return () => {
      stopCountdown();
    };
  }, []);

  // CRITICAL: Reset all state on mount to prevent stale values from showing "Timer Ended"
  // This MUST run synchronously before any other effects
  // Also clears any cached state that might persist
  useEffect(() => {
    console.log('ViewPage: Component mounted, resetting all state and clearing cache');
    // Explicitly reset all timer-related state on mount - use functional updates to ensure they happen
    setTimerEnded(() => false);
    setIsRunning(() => false);
    setIsPaused(() => false);
    setHasActiveTimer(() => false); // Reset timer active state
    setIsResultVisible(() => false);
    setPendingWord(() => '');
    setJudgeResult(() => null);
    setTimeLeft(() => 60);
    setDisplayMode('timer'); // Reset display mode
    setVideoUrl(''); // Clear video URL
    setIsImageVisible(false); // Reset image visibility
    // Reset all refs synchronously
    judgeResultRef.current = null;
    pendingJudgeResultRef.current = false;
    wasRunningRef.current = false;
    startBeepPlayedRef.current = false;
    shouldShowTimerRef.current = false;
    shouldShowResultRef.current = false;
    lastBeepRef.current = -1;
    lastUpdateTimeRef.current = -1;
    mediaTypeRef.current = 'video'; // Reset media type ref
    // Clear any existing timers
    clearResultTimers();
    stopCountdown();
    timerEndTimestampRef.current = null;
    console.log('ViewPage: All state and cache reset on mount');
  }, []); // Run only on mount

  // Play beep sounds when Latest Result becomes visible
  useEffect(() => {
    if (isResultVisible && judgeResult) {
      console.log('Latest Result is now visible, playing sound. isCorrect:', judgeResult.isCorrect);
      // Ensure audio context is ready
      soundManager.ensureAudioContext();
      // Play sound when result becomes visible
      setTimeout(() => {
        if (judgeResult.isCorrect) {
          console.log('Playing correct beep sound');
          soundManager.playCorrectSound();
        } else {
          console.log('Playing incorrect beep sound');
          soundManager.playIncorrectSound();
        }
      }, 100);
    }
  }, [isResultVisible, judgeResult]);

  useEffect(() => {
    console.log('ViewPage: Setting up broadcast listener');
    
    // CRITICAL: Reset initialization flag on mount
    isInitializedRef.current = false;
    
    // Mark as initialized after a delay to avoid processing stale messages on mount
    // Increased delay to ensure state reset completes first and Firebase sync is ready
    const initTimeout = setTimeout(() => {
      isInitializedRef.current = true;
      console.log('ViewPage: Initialized, will now process messages');
    }, 1500); // Increased to 1500ms to ensure Firebase initial load completes
    
    const cleanup = broadcastManager.listen((message: QuizMessage) => {
      console.log('ViewPage: Received message:', message.type, message);
      
      // CRITICAL: Ignore ALL messages that arrive before initialization to prevent automatic triggers
      // This prevents stale messages from causing unwanted displays on the view screen
      if (!isInitializedRef.current) {
        console.log('ViewPage: Ignoring message received before initialization:', message.type);
        return;
      }

      const sentAt = typeof message.sentAt === 'number' ? message.sentAt : null;
      if (sentAt) {
        const age = Date.now() - sentAt;
        if (age > STALE_MESSAGE_MAX_MS) {
          console.log('ViewPage: Ignoring stale message older than threshold:', {
            type: message.type,
            age,
            sentAt
          });
          return;
        }
      }
      
      // CRITICAL: Ignore ALL 'end' messages if timer was never running
      // This prevents stale end messages from showing "Timer Ended" when page first loads
      if (message.type === 'end') {
        // Only process end messages if:
        // 1. Timer was actually running (wasRunningRef.current was true), OR
        // 2. We have a pending word (meaning timer was active), OR
        // 3. The message has a word AND we're currently running/paused (active timer)
        const timerWasActive = wasRunningRef.current || isRunning || isPaused;
        const hasWord = pendingWord || message.data?.word;
        
        if (!timerWasActive && !hasWord) {
          console.log('ViewPage: Ignoring stale end message - timer was never running and no word');
          return;
        }
        
        // Additional safety: if timer was never running, ignore end messages even if they have a word
        // This prevents stale end messages from previous sessions
        if (!wasRunningRef.current && !isRunning && !isPaused) {
          console.log('ViewPage: Ignoring end message - timer was never running in this session');
          return;
        }
      }
      
      // CRITICAL: Ignore 'control: end' messages if timer was never running
      if (message.type === 'control' && message.control?.action === 'end') {
        const timerWasActive = wasRunningRef.current || isRunning || isPaused;
        if (!timerWasActive) {
          console.log('ViewPage: Ignoring control end message - timer was never running');
          return;
        }
      }
      
      switch (message.type) {
        case 'update':
          // CRITICAL: Only ignore update messages if we have a judge result AND timer is not starting
          // Allow update messages when timer is starting (isRunning transitions from false to true)
          // This ensures counter appears when restart is pressed
          const isTimerStarting = message.data?.isRunning && !wasRunningRef.current;
          const hasActiveContext =
            isExpectingJudgeRef.current ||
            wasRunningRef.current ||
            isRunning ||
            isPaused;
          if (message.data?.isRunning && !hasActiveContext && !isTimerStarting) {
            console.log('ViewPage: Ignoring running update with no active context', {
              word: message.data.word,
              sentAt
            });
            break;
          }
          if ((judgeResult || judgeResultRef.current || pendingJudgeResultRef.current) && !isTimerStarting) {
            console.log('ViewPage: Ignoring update message - judge result exists or pending and timer not starting');
            break;
          }
          
          // If timer is starting, clear judge result to allow counter to appear
          if (isTimerStarting) {
            console.log('ViewPage: Timer starting, clearing judge result to show counter');
            shouldShowTimerRef.current = true;
            shouldShowResultRef.current = false;
            setJudgeResult(null);
            judgeResultRef.current = null;
            pendingJudgeResultRef.current = false;
            setTimerEnded(false);
            setIsResultVisible(false);
            setPendingWord('');
            clearResultTimers();
          }
          
          let effectiveTimeLeft = message.data?.timeLeft ?? timeLeft;
          if (message.data?.endsAt && message.data.isRunning) {
            timerEndTimestampRef.current = message.data.endsAt;
            effectiveTimeLeft = Math.max(0, Math.floor((message.data.endsAt - Date.now()) / 1000));
            startCountdown();
            isExpectingJudgeRef.current = true;
          } else if (message.data && !message.data.isRunning) {
            timerEndTimestampRef.current = null;
            stopCountdown();
            isExpectingJudgeRef.current = false;
            setHasActiveTimer(false); // Reset when timer stops
            startBeepPlayedRef.current = false; // Reset beep flag so it can play again on next start
          }
          
          // Only update ViewPage if timer is actually running (isRunning === true)
          // Don't update on row selection - that's only for ManageScreen
          if (message.data && message.data.isRunning) {
            const wasRunning = wasRunningRef.current;
            const isNowRunning = message.data.isRunning;
            
            // Play start beep when timer first starts (transitions from not running to running)
            // Use ref to prevent double beep if message is processed multiple times
            if (!wasRunning && isNowRunning && !startBeepPlayedRef.current) {
              soundManager.ensureAudioContext();
              soundManager.playStartSound();
              startBeepPlayedRef.current = true;
              console.log('Timer started - playing start beep');
            }
            
            // CRITICAL: Update display refs FIRST to prevent flash during state transitions
            // This ensures the correct display appears immediately
            shouldShowTimerRef.current = true;
            shouldShowResultRef.current = false;
            
            // Then update state - React will batch these
            setIsRunning(message.data.isRunning);
            setIsPaused(!message.data.isRunning);
            setHasActiveTimer(true); // Mark timer as active immediately
            setTimeLeft(effectiveTimeLeft);
            setTimerEnded(false);
            // Only clear result-related states if we're not showing a result AND no judge result exists
            // Check both state and ref to prevent race conditions
            // This prevents clearing judge result when timer updates come in during the delay period
            if (!isResultVisible && !judgeResult && !judgeResultRef.current) {
            setPendingWord('');
            setIsResultVisible(false);
            setJudgeResult(null);
              judgeResultRef.current = null;
              pendingJudgeResultRef.current = false;
            }
            // Don't clear timers if we have a pending judge result (even if not visible yet)
            if (!judgeResult && !judgeResultRef.current) {
            clearResultTimers();
            }
            wasRunningRef.current = isNowRunning;
          }
          // If message.data.isRunning is false or missing, ignore it (row selection)
          break;
        case 'speech':
          if (message.speechData && message.speechData.shouldSpeak) {
            const timeToBeep = message.speechData.timeLeft;
            // Only beep if we haven't beeped this time yet
            if (lastBeepRef.current !== timeToBeep) {
              soundManager.ensureAudioContext();
              soundManager.playCountdownBeep();
              lastBeepRef.current = timeToBeep;
            }
          }
          break;
        case 'pause':
          stopCountdown();
          timerEndTimestampRef.current = null;
          setIsPaused(true);
          setIsRunning(false);
          setHasActiveTimer(true); // Keep true when paused (timer is still active)
          wasRunningRef.current = false;
          // Don't reset startBeepPlayedRef on pause - timer is still active, just paused
          break;
        case 'control':
          // Handle control messages directly (e.g., from ManageScreen)
          if (message.control?.action === 'start') {
            console.log('ViewPage: Received control start message', { duration: message.control.duration });
            // When timer starts, clear any judge results and reset timer states
            // This ensures the counter appears properly when restart is pressed
            setJudgeResult(null);
            judgeResultRef.current = null;
            pendingJudgeResultRef.current = false;
            setTimerEnded(false);
            setIsResultVisible(false);
            setPendingWord('');
            clearResultTimers();
            stopCountdown();
            timerEndTimestampRef.current = null;
            // Timer will be started by the update message from ActionPage
            // But we prepare the state here to ensure counter appears
            const duration = message.control.duration || 60;
            setTimeLeft(duration);
            setIsRunning(false); // Will be set to true by update message
            setIsPaused(false);
            wasRunningRef.current = false;
            isExpectingJudgeRef.current = true;
            console.log('ViewPage: Prepared for timer start, waiting for update message');
          } else if (message.control?.action === 'pause') {
            console.log('ViewPage: Received control pause message', { isRunning, isPaused });
            // Toggle pause state - only if timer is actually running or paused
            if (isRunning || isPaused) {
              setIsPaused(prevPaused => {
                const newPaused = !prevPaused;
                setIsRunning(!newPaused);
                wasRunningRef.current = !newPaused;
                if (newPaused) {
                  stopCountdown();
                  timerEndTimestampRef.current = null;
                }
                console.log('ViewPage: Toggling pause state', { from: prevPaused, to: newPaused, isRunning: !newPaused });
                return newPaused;
              });
            } else {
              console.log('ViewPage: Ignoring pause - timer not active');
            }
          } else if (message.control?.action === 'end') {
            console.log('ViewPage: Received control end message');
            // CRITICAL: Double-check that timer was actually running before processing end
            // This prevents stale control end messages from previous sessions
            if (!wasRunningRef.current && !isRunning && !isPaused) {
              console.log('ViewPage: Ignoring control end message - timer was never running in this session');
              break;
            }
            
            wasRunningRef.current = false;
            // CRITICAL: Check pending flag, state, and ref to handle out-of-order messages
            // If we're expecting a judge result or already have one, don't process 'end' message
            if (pendingJudgeResultRef.current || judgeResult || judgeResultRef.current) {
              console.log('ViewPage: Ignoring control end message - judge result exists or pending', { 
                pending: pendingJudgeResultRef.current,
                judgeResult, 
                ref: judgeResultRef.current 
              });
              break;
            }
            // Clear timers and reset state
            clearResultTimers();
            stopCountdown();
            timerEndTimestampRef.current = null;
            setTimerEnded(false);
            setIsResultVisible(false);
            setIsRunning(false);
            setIsPaused(false);
            setPendingWord('');
            setJudgeResult(null);
            judgeResultRef.current = null;
            pendingJudgeResultRef.current = false;
            setTimeLeft(60);
            lastBeepRef.current = -1;
            isExpectingJudgeRef.current = false;
          }
          break;
        case 'end':
          // CRITICAL: Double-check that timer was actually running before processing end
          // This prevents stale end messages from previous sessions
          if (!wasRunningRef.current && !isRunning && !isPaused) {
            console.log('ViewPage: Ignoring end message - timer was never running in this session');
            break;
          }
          
          wasRunningRef.current = false;
          // CRITICAL: Check pending flag, state, and ref to handle out-of-order messages
          // If we're expecting a judge result or already have one, don't process 'end' message
          // The judge result should take precedence - DON'T clear timers if judge result exists
          // This prevents race condition where timer ends naturally after judge sends result
          if (pendingJudgeResultRef.current || judgeResult || judgeResultRef.current) {
            console.log('ViewPage: Ignoring end message - judge result exists or pending, preserving result timers', { 
              pending: pendingJudgeResultRef.current,
              judgeResult, 
              ref: judgeResultRef.current,
              isResultVisible,
              pendingWord
            });
            break;
          }
          // Only clear timers if we don't have a judge result
          clearResultTimers();
          stopCountdown();
          timerEndTimestampRef.current = null;
          if (message.data && message.data.word) {
            const wordToShow = message.data.word;
            soundManager.ensureAudioContext();
            soundManager.playTimerEndBeep();
            // Set all states together in one batch to prevent flash
            setIsRunning(false);
            setIsPaused(false);
            setIsResultVisible(false);
            // startResultWindow will set timerEnded(true) if word is valid
            startResultWindow(wordToShow);
          } else {
            // No word - reset everything
            shouldShowTimerRef.current = false;
            shouldShowResultRef.current = false;
            startBeepPlayedRef.current = false;
            setTimerEnded(false);
            setIsResultVisible(false);
            setIsRunning(false);
            setIsPaused(false);
            setHasActiveTimer(false); // Reset timer active state
            setPendingWord('');
            setJudgeResult(null);
            judgeResultRef.current = null;
            pendingJudgeResultRef.current = false;
            setTimeLeft(60);
            isExpectingJudgeRef.current = false;
          }
          lastBeepRef.current = -1;
          break;
        case 'clear':
          // Only play sound if there was actually something active to clear
          // This prevents beep when Excel is uploaded (silent reset)
          const hadActiveContent = pendingWord || isRunning || isPaused || timerEnded || isResultVisible || judgeResult || judgeResultRef.current || videoUrl || displayMode === 'video';
          
          clearResultTimers();
          stopCountdown();
          timerEndTimestampRef.current = null;
          
          // Only play sound if there was something to clear
          if (hadActiveContent) {
            soundManager.ensureAudioContext();
          soundManager.playWordClearBeep();
          }
          
          shouldShowTimerRef.current = false;
          shouldShowResultRef.current = false;
          startBeepPlayedRef.current = false;
          setPendingWord('');
          setTimeLeft(60);
          setIsRunning(false);
          setIsPaused(false);
          setHasActiveTimer(false); // Reset timer active state
          setTimerEnded(false);
          setIsResultVisible(false);
          setVideoUrl('');
          setDisplayMode('timer');
          setMediaType('video');
          setIsImageVisible(false);
          setJudgeResult(null);
          judgeResultRef.current = null;
          pendingJudgeResultRef.current = false;
          wasRunningRef.current = false;
          lastBeepRef.current = -1;
          isExpectingJudgeRef.current = false;
          break;
        case 'video':
          if (message.videoData) {
            const previousMediaType = mediaTypeRef.current;
            const incomingMediaType = message.videoData.mediaType ?? previousMediaType;
            if (incomingMediaType !== previousMediaType) {
              setMediaType(incomingMediaType);
            }
            // Update display mode if provided - this should happen first
            // CRITICAL: Always update displayMode when provided, even if it seems the same
            // This ensures proper mode switching after timer ends
            if (message.videoData.displayMode) {
              const newMode = message.videoData.displayMode;
              
              // Always set display mode, even if it's the same (handles stuck states)
              setDisplayMode(newMode);
              
              // When switching to timer mode, clear timer-related states if no timer is running
              if (newMode === 'timer') {
                // When switching to timer mode, clear word unless timer just ended
                // Timer running state will be updated by 'update' messages
                setTimerEnded(false);
                setIsResultVisible(false);
                setIsImageVisible(false);
                // Don't clear word here - it might be from a timer that just ended
                // Only clear if it's a stop action
                if (message.videoData.action === 'stop') {
                  clearResultTimers();
                  setPendingWord('');
                  setIsRunning(false);
                  setIsPaused(false);
                  setTimeLeft(60);
                  setJudgeResult(null);
                  judgeResultRef.current = null;
                  pendingJudgeResultRef.current = false;
                  setVideoUrl('');
                  setMediaType('video');
                }
              }
              
              // When switching to video mode, ensure timer states are cleared
              // This is especially important when switching from timer mode after word ends
              if (newMode === 'video') {
                console.log('ViewPage: Switching to video mode, clearing timer states');
                clearResultTimers();
                setIsRunning(false);
                setIsPaused(false);
                setTimerEnded(false);
                setIsResultVisible(false);
                // Keep word cleared when switching to video
                setPendingWord('');
                setJudgeResult(null);
                judgeResultRef.current = null;
                pendingJudgeResultRef.current = false;
                if (incomingMediaType === 'image') {
                  setIsImageVisible(false);
                }
                isExpectingJudgeRef.current = false;
              }
            }
            
            // Update video URL
            if (message.videoData.url !== undefined) {
              setVideoUrl(message.videoData.url || '');
              if (incomingMediaType === 'image' && !message.videoData.action) {
                setIsImageVisible(false);
              }
            }
            
            if (incomingMediaType === 'image') {
              if (message.videoData?.action === 'play') {
                setIsImageVisible(true);
              } else if (message.videoData?.action === 'pause') {
                setIsImageVisible(false);
              } else if (message.videoData?.action === 'stop') {
                setIsImageVisible(false);
                setVideoUrl('');
                setDisplayMode('timer');
                setMediaType('video');
                isExpectingJudgeRef.current = false;
                isExpectingJudgeRef.current = false;
              }
              break;
            }
            
            // Control video playback - use setTimeout to ensure DOM is updated
            setTimeout(() => {
              const video = videoRef.current;
              if (!video) {
                console.warn('ViewPage: Video element not found');
                return;
              }
              
              if (message.videoData?.action === 'play') {
                // CRITICAL: Use URL from message first (always current), then fallback to state
                // This ensures we have the URL even if state hasn't updated yet
                const urlToPlay = message.videoData.url || videoUrl;
                
                if (!urlToPlay) {
                  console.warn('ViewPage: No video URL available for play action');
                  return;
                }
                
                console.log('ViewPage: Attempting to play video:', urlToPlay);
                
                // Ensure video source is set - always set it even if it seems the same
                // This handles cases where the video element was reset or not properly initialized
                if (video.src !== urlToPlay) {
                  console.log('ViewPage: Setting video source:', urlToPlay);
                  video.src = urlToPlay;
                  video.load();
                }
                
                // Function to attempt playing the video
                const attemptPlay = () => {
                  video.play()
                    .then(() => {
                      console.log('ViewPage: Video playing successfully');
                    })
                    .catch((error) => {
                      console.error('ViewPage: Error playing video:', error);
                      // Retry once after a short delay if video wasn't ready
                      if (error.name === 'NotAllowedError' || error.name === 'NotReadyStateError') {
                        setTimeout(() => {
                          video.play().catch(err => console.error('ViewPage: Retry play failed:', err));
                        }, 100);
                      }
                    });
                };
                
                // Wait for video to be ready before playing
                if (video.readyState >= 2) {
                  // Video is ready, play immediately
                  attemptPlay();
                } else {
                  // Video not ready, wait for it to load
                  console.log('ViewPage: Video not ready, waiting for loadeddata event');
                  const playWhenReady = () => {
                    console.log('ViewPage: Video loaded, attempting to play');
                    attemptPlay();
                  };
                  // Remove any existing listeners to avoid duplicates
                  video.removeEventListener('loadeddata', playWhenReady);
                  video.addEventListener('loadeddata', playWhenReady, { once: true });
                  
                  // Also try canplay event as fallback
                  const playWhenCanPlay = () => {
                    console.log('ViewPage: Video can play, attempting to play');
                    attemptPlay();
                  };
                  video.removeEventListener('canplay', playWhenCanPlay);
                  video.addEventListener('canplay', playWhenCanPlay, { once: true });
                  
                  // Ensure video is loading
                  if (video.readyState === 0) {
                  video.load();
                  }
                }
              } else if (message.videoData?.action === 'pause') {
                console.log('ViewPage: Pausing video');
                video.pause();
              } else if (message.videoData?.action === 'stop') {
                console.log('ViewPage: Stopping video');
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
            // Check if message is stale first
            const sentAt = typeof message.sentAt === 'number' ? message.sentAt : null;
            if (sentAt) {
              const age = Date.now() - sentAt;
              if (age > STALE_MESSAGE_MAX_MS) {
                console.log('ViewPage: Ignoring stale judge result:', {
                  age,
                  sentAt,
                  actualWord: message.judgeData.actualWord
                });
                break;
              }
            }
            
            // Accept judge results if:
            // 1. We have a valid actualWord (there was a word being judged)
            // 2. Message is recent (checked above)
            // 3. We're not already showing a different result (unless it's for the same word)
            const hasValidWord = message.judgeData.actualWord && message.judgeData.actualWord.trim() !== '';
            const isSameWord = judgeResultRef.current?.actualWord === message.judgeData.actualWord;
            
            // Only ignore if we have no valid word OR if we're showing a different word's result
            if (!hasValidWord) {
              console.log('ViewPage: Ignoring judge result - no valid actualWord');
              break;
            }
            
            // If we already have a result for a different word, ignore the new one (unless it's more recent)
            if (judgeResultRef.current && !isSameWord && sentAt) {
              // Could check if new message is more recent, but for simplicity, accept if timer was running recently
              const hadActiveTimer = wasRunningRef.current || isRunning || isPaused || isExpectingJudgeRef.current;
              if (!hadActiveTimer) {
                console.log('ViewPage: Ignoring judge result - different word and no active timer');
                break;
              }
            }
            console.log('ViewPage: Received judge result:', message.judgeData);
            console.log('ViewPage: Typed word received:', {
              typedWord: message.judgeData.typedWord,
              type: typeof message.judgeData.typedWord,
              length: message.judgeData.typedWord?.length,
              actualWord: message.judgeData.actualWord,
              isCorrect: message.judgeData.isCorrect
            });
            // CRITICAL: Set pending flag FIRST to protect against out-of-order messages
            pendingJudgeResultRef.current = true;
            isExpectingJudgeRef.current = false;
            
            // Ensure typedWord is always a string (even if empty)
            const normalizedJudgeData = {
              ...message.judgeData,
              typedWord: (message.judgeData.typedWord !== undefined && message.judgeData.typedWord !== null)
                ? String(message.judgeData.typedWord)
                : '',
              actualWord: String(message.judgeData.actualWord || ''),
              isCorrect: message.judgeData.isCorrect || false
            };
            
            // CRITICAL: Set judge result ref FIRST (synchronously) before any state updates
            // This ensures 'end' messages that arrive later will see the ref and skip processing
            judgeResultRef.current = normalizedJudgeData;
            console.log('ViewPage: Judge result ref set immediately:', {
              actualWord: judgeResultRef.current.actualWord,
              typedWord: judgeResultRef.current.typedWord,
              typedWordType: typeof judgeResultRef.current.typedWord,
              typedWordLength: judgeResultRef.current.typedWord.length,
              isCorrect: judgeResultRef.current.isCorrect
            });
            console.log('ViewPage: Pending judge result flag set to true');
            
            // Clear any existing result timers first
            clearResultTimers();
            stopCountdown();
            timerEndTimestampRef.current = null;
            // Ensure we're in timer mode to display results
            setDisplayMode('timer');
            // Set judge result state (ref already set above) - use normalized data
            setJudgeResult(normalizedJudgeData);
            console.log('ViewPage: Judge result state set with normalized data:', normalizedJudgeData);
            console.log('ViewPage: Judge result typedWord after setting state:', normalizedJudgeData.typedWord);
            // CRITICAL: Update display refs FIRST to prevent flash
            shouldShowTimerRef.current = false;
            shouldShowResultRef.current = true;
            
            // Stop timer states IMMEDIATELY - this stops the counter from updating
            setIsRunning(false);
            setIsPaused(false);
            setHasActiveTimer(false); // Reset timer active state when result arrives
            setTimeLeft(0); // Reset timer to 0 to stop display
            setTimerEnded(true);
            wasRunningRef.current = false; // Update ref to prevent timer from restarting
            // Use startResultWindow with preserveJudgeResult=true to keep judge result visible
            // This shows the result after delay, same as timer end, but preserves judge data
            startResultWindow(message.judgeData.actualWord, false, true);
            console.log('ViewPage: Judge result processed, timer stopped, result will show after', RESULT_DELAY_MS, 'ms delay');
            // Sounds will be played when result becomes visible (see useEffect below)
          }
          break;
      }
    });

    return () => {
      clearTimeout(initTimeout);
      cleanup();
    };
  }, []);


  // Handle video URL changes and ensure video element is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || displayMode !== 'video' || !videoUrl || mediaType !== 'video') return;

    // Ensure video source is set when URL changes
    if (video.src !== videoUrl) {
      video.src = videoUrl;
      video.load();
    }
  }, [videoUrl, displayMode, mediaType]);

  // Handle video end event - automatically close video screen when video ends
  useEffect(() => {
    const video = videoRef.current;
    if (!video || displayMode !== 'video' || mediaType !== 'video') return;

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
          displayMode: 'timer',
          mediaType: 'video'
        }
      });
    };

    video.addEventListener('ended', handleVideoEnd);

    return () => {
      video.removeEventListener('ended', handleVideoEnd);
    };
  }, [videoUrl, displayMode, mediaType]);

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
          <h1 className="text-2xl font-bold">APIIT SPELLING BEE 2025</h1>
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
        {/* Show media if in video mode - fullscreen without controls */}
        {displayMode === 'video' ? (
          videoUrl ? (
            mediaType === 'image' ? (
              isImageVisible ? (
                <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
                  <img
                    src={videoUrl}
                    alt="Quiz media"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-8xl mb-8">🖼️</div>
                  <h2 className="text-6xl font-bold text-slate-400 mb-4">Image Paused</h2>
                  <p className="text-3xl text-slate-500">
                    Press Play on Manage Screen to display the image
                  </p>
                </div>
              )
            ) : (
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
            )
          ) : (
          <div className="text-center">
            <div className="text-8xl mb-8">🎬</div>
              <h2 className="text-6xl font-bold text-slate-400 mb-4">Waiting for Media</h2>
            <p className="text-3xl text-slate-500">
                Select a video or image in Manage Screen
            </p>
          </div>
          )
        ) : displayMode === 'timer' && timerEnded && !isResultVisible && pendingWord ? (
          /* Show waiting message during 5 second delay after timer ends */
          /* CRITICAL: Show if pendingWord exists and result is not yet visible - this shows even when judgeResult exists but isResultVisible is false */
          <div className="text-center">
            <div className="text-8xl mb-8">⏳</div>
            <h2 className="text-6xl font-bold text-slate-400 mb-4">Timer Ended</h2>
            <p className="text-3xl text-slate-500">
              Word will appear shortly...
            </p>
          </div>
        ) : displayMode === 'timer' && (shouldShowTimerRef.current || (isRunning || isPaused || hasActiveTimer)) && !shouldShowResultRef.current && !isResultVisible ? (
          /* Show ONLY timer when running or paused - word is always hidden during countdown */
          /* Hide timer when result is visible - use refs to prevent flashing */
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
            {/* <div className="text-8xl mb-8">🎯</div> */}
            <h2
              data-testid="view-ready-message"
              className="text-6xl	font-bold text-slate-400 mb-4"
            >
              🐝Next Word Loading... Get Ready to Spell!
            </h2>
          </div>
        )}
      </div>
      {displayMode === 'timer' && (isResultVisible || (judgeResult && pendingWord)) && (
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 pb-8 lg:pb-10 overflow-x-hidden">
          <div className="w-full max-w-5xl mx-auto">
          <div
              className={`w-full rounded-3xl border-2 p-4 sm:p-6 lg:p-8 text-center ${
              judgeResult
                ? judgeResult.isCorrect
                  ? 'bg-green-900/40 border-green-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                  : 'bg-red-900/40 border-red-500 shadow-[0_0_30px_rgba(248,113,113,0.3)]'
                : 'bg-slate-900/40 border-white/10'
            }`}
          >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 lg:mb-6">
              <div className="text-left">
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Latest Result</h3>
                {judgeResult && (
                    <p
                      className={`text-xl sm:text-2xl lg:text-3xl font-semibold mt-2 ${
                        judgeResult.isCorrect ? 'text-green-300' : 'text-red-300'
                      }`}
                    >
                      {judgeResult.isCorrect ? 'Correct spelling!' : 'Incorrect spelling'}
                  </p>
                )}
              </div>
              {judgeResult && (
                <span
                    className={`px-4 sm:px-6 py-2 rounded-full text-lg sm:text-xl lg:text-2xl font-semibold whitespace-nowrap ${
                    judgeResult.isCorrect ? 'bg-green-500 text-slate-900' : 'bg-red-500 text-white'
                  }`}
                >
                  {judgeResult.isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              )}
            </div>
              <div
                className={`rounded-2xl p-4 sm:p-6 lg:p-8 border-2 shadow-2xl text-left ${
                  judgeResult
                    ? judgeResult.isCorrect
                      ? 'bg-gradient-to-br from-emerald-900/70 via-emerald-950 to-slate-950 border-emerald-400/60'
                      : 'bg-gradient-to-br from-rose-900/70 via-rose-950 to-slate-950 border-rose-400/60'
                    : 'bg-gradient-to-br from-slate-900 via-slate-950 to-black border-white/10'
                }`}
              >
                <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold uppercase tracking-wider text-slate-200 mb-3">
                  Correct Word
                </p>
                <p
                  data-testid="view-result-correct"
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black break-words tracking-tight drop-shadow-[0_0_25px_rgba(255,255,255,0.25)] leading-tight"
                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', hyphens: 'auto' }}
                >
                  {pendingWord || judgeResult?.actualWord || ''}
                </p>
              </div>
              <p className="mt-4 sm:mt-6 text-slate-300 text-base sm:text-lg lg:text-xl">Result shared from Judge Console</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
