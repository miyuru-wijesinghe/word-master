import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';

const normalizeWord = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '');

export const JudgePage: React.FC = () => {
  const [currentWord, setCurrentWord] = useState('');
  const [typedWord, setTypedWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState<'waiting' | 'running' | 'paused'>('waiting');
  const [autoSubmitPending, setAutoSubmitPending] = useState(false);

  const typedWordRef = useRef('');
  const currentWordRef = useRef('');
  const lastSubmittedSignatureRef = useRef<string>('');
  const autoSubmitPendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerEndTimestampRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    typedWordRef.current = typedWord;
  }, [typedWord]);

  useEffect(() => {
    currentWordRef.current = currentWord;
  }, [currentWord]);

  useEffect(() => {
    autoSubmitPendingRef.current = autoSubmitPending;
  }, [autoSubmitPending]);

  const stopCountdown = () => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startCountdown = () => {
    stopCountdown();
    if (!timerEndTimestampRef.current) {
      return;
    }
    countdownIntervalRef.current = window.setInterval(() => {
      if (!timerEndTimestampRef.current) {
        stopCountdown();
        return;
      }
      const remaining = Math.max(0, Math.floor((timerEndTimestampRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        stopCountdown();
        timerEndTimestampRef.current = null;
      }
    }, 250);
  };

  useEffect(() => {
    return () => {
      stopCountdown();
    };
  }, []);

  const resetJudgeState = () => {
    stopCountdown();
    timerEndTimestampRef.current = null;
    setCurrentWord('');
    setTypedWord('');
    typedWordRef.current = '';
    setTimeLeft(60);
    setStatus('waiting');
    setAutoSubmitPending(false);
  };

  const submitResult = (actualWord?: string, trigger: 'auto' | 'manual' = 'manual') => {
    // Preserve word before clearing state - critical for manual submissions
    const resolvedWord = (actualWord && actualWord.trim()) || currentWordRef.current.trim();
    if (!resolvedWord) {
      console.warn('Cannot submit result: no word available');
      return;
    }

    // CRITICAL: For manual submissions, read DOM value FIRST as it's the most reliable source
    // The DOM element always has the current value, even if React state/ref haven't updated yet
    // This prevents empty values when user types and immediately clicks button
    const domValue = (textareaRef.current?.value || '').trim();
    const refValue = (typedWordRef.current || '').trim();
    const stateValue = (typedWord || '').trim();
    
    // For manual: prefer DOM (most reliable, always current), then ref, then state as fallback
    // DOM is the source of truth since it's the actual input element
    let capturedTyped: string;
    if (trigger === 'manual') {
      // DOM first (most reliable - actual input value), then ref, then state
      // This ensures we capture the value even if React hasn't processed the onChange yet
      capturedTyped = domValue || refValue || stateValue;
      // If all are empty, that's okay - we'll send empty string
    } else {
      // For auto, prefer ref (state might be cleared by then), but fallback to DOM
      capturedTyped = refValue || domValue;
    }
    
    console.log('Capturing typed word:', {
      trigger,
      fromRef: typedWordRef.current,
      fromState: typedWord,
      fromDOM: textareaRef.current?.value,
      refValue,
      domValue,
      stateValue,
      captured: capturedTyped,
      capturedLength: capturedTyped.length
    });
    
    const normalizedActual = normalizeWord(resolvedWord);
    const normalizedTyped = normalizeWord(capturedTyped);
    const isCorrect =
      normalizedActual.length > 0 &&
      normalizedTyped.length > 0 &&
      normalizedActual === normalizedTyped;

    // Always send the actual typed word value (even if empty), not a fallback
    // The display will handle showing '—' if needed
    // Ensure it's always a string, never undefined/null
    const displayTyped = (capturedTyped === undefined || capturedTyped === null) 
      ? '' 
      : String(capturedTyped);
    
    const signature = `${resolvedWord.toLowerCase()}::${displayTyped.toLowerCase()}::${trigger}`;

    if (trigger === 'auto' && signature === lastSubmittedSignatureRef.current) {
      console.log('Skipping duplicate auto submission');
      return;
    }
    lastSubmittedSignatureRef.current = signature;

    // Always send judge result - this is the main message that displays on view screen
    // displayTyped is already guaranteed to be a string from above
    const judgeMessage: QuizMessage = {
        type: 'judge',
        judgeData: {
          actualWord: resolvedWord,
        typedWord: displayTyped, // Already a string, guaranteed above
          isCorrect
        }
    };
    
    console.log('Sending judge result:', JSON.stringify(judgeMessage, null, 2));
    console.log('Judge message details:', {
      actualWord: resolvedWord,
      typedWord: displayTyped,
      typedWordType: typeof displayTyped,
      typedWordLength: displayTyped.length,
      isCorrect,
      capturedTyped,
      stateValue,
      refValue
    });
    console.log('BroadcastChannel available:', typeof BroadcastChannel !== 'undefined');
    
    // Send message - ensure it's sent before clearing state
    try {
      broadcastManager.send(judgeMessage);
      console.log('Judge result sent via broadcastManager successfully');
    } catch (error) {
      console.error('Error sending judge result:', error);
      // Don't clear state if send failed - allow retry
      return;
    }

    // For manual submissions, send control 'end' to stop timer
    // CRITICAL: Delay must be long enough to ensure judge message is processed first
    // Increased to 500ms to account for Firebase network latency and message ordering
    if (trigger === 'manual') {
      setTimeout(() => {
        console.log('JudgePage: Sending control end message after delay');
        broadcastManager.send({
          type: 'control',
          control: {
            action: 'end'
          }
        });
      }, 500); // Increased from 200ms to 500ms for better reliability
      }

    // Clear state after sending messages
    stopCountdown();
    timerEndTimestampRef.current = null;
      setStatus('waiting');
      setTimeLeft(0);
      setCurrentWord('');
    currentWordRef.current = '';
      setTypedWord('');
    typedWordRef.current = '';

    setAutoSubmitPending(false);
  };

  useEffect(() => {
    const cleanup = broadcastManager.listen((message: QuizMessage) => {
      switch (message.type) {
        case 'update': {
          if (!message.data) break;
            const incomingWord = message.data.word;
          const incomingTimeLeft = typeof message.data.timeLeft === 'number' ? message.data.timeLeft : 60;
          const isTimerRunning = !!message.data.isRunning;

          if (incomingWord && incomingWord !== currentWordRef.current) {
            setCurrentWord(incomingWord);
            currentWordRef.current = incomingWord;
            setTypedWord('');
            typedWordRef.current = '';
          }

          if (isTimerRunning) {
            setStatus('running');
            setAutoSubmitPending(true);
            autoSubmitPendingRef.current = true;
            // CRITICAL: Always use endsAt from message if available for proper sync
            // This ensures timer stays in sync across all screens
            const targetEndsAt = message.data.endsAt ?? (Date.now() + incomingTimeLeft * 1000);
            timerEndTimestampRef.current = targetEndsAt;
            const effectiveTimeLeft = Math.max(0, Math.floor((targetEndsAt - Date.now()) / 1000));
            setTimeLeft(effectiveTimeLeft);
            startCountdown();
          } else {
            stopCountdown();
            timerEndTimestampRef.current = null;
            setAutoSubmitPending(false);
            autoSubmitPendingRef.current = false;
            setStatus('waiting');
            // CRITICAL: Only update timeLeft if we had an active timer before (status was 'running' or 'paused')
            // This prevents showing 1:00 when update messages arrive without a timer running
            // Only set to 60 if we're explicitly resetting from a paused/stopped state with a valid timeLeft
            if (status === 'running' || status === 'paused') {
              // Timer was running/paused, now stopped - use incoming timeLeft or keep at 0
              setTimeLeft(incomingTimeLeft > 0 ? incomingTimeLeft : 0);
            } else {
              // No timer was active, don't update timeLeft (keep it at 0 or current value)
              // This prevents showing 1:00 when update messages arrive during idle state
            }
          }
          break;
        }
        case 'pause':
          stopCountdown();
          // Update timerEndTimestampRef if endsAt is provided in pause message for proper sync
          if (message.data?.endsAt) {
            timerEndTimestampRef.current = message.data.endsAt;
            const effectiveTimeLeft = Math.max(0, Math.floor((message.data.endsAt - Date.now()) / 1000));
            setTimeLeft(effectiveTimeLeft);
          } else if (message.data?.timeLeft !== undefined) {
            // Fallback: if no endsAt, preserve timeLeft value
            setTimeLeft(message.data.timeLeft);
          }
          setStatus('paused');
          setAutoSubmitPending(true);
          autoSubmitPendingRef.current = true;
          break;
        case 'control':
          // Handle control messages directly (e.g., from ManageScreen)
          if (message.control?.action === 'end') {
            console.log('JudgePage: Received control end message');
            stopCountdown();
            timerEndTimestampRef.current = null;
            if (autoSubmitPendingRef.current) {
              // If auto-submit is pending, submit the result
              submitResult(message.data?.word, 'auto');
            } else {
              // Otherwise, just reset to waiting state
              setStatus('waiting');
              setTimeLeft(0);
            }
            setAutoSubmitPending(false);
          }
          break;
        case 'end': {
          stopCountdown();
          timerEndTimestampRef.current = null;
          if (autoSubmitPendingRef.current) {
            submitResult(message.data?.word, 'auto');
          } else {
          setStatus('waiting');
          setTimeLeft(0);
          }
          setAutoSubmitPending(false);
          break;
        }
        case 'clear':
          resetJudgeState();
          break;
        case 'video':
          // Ignore video events but ensure judge UI resets when switching away from timer mode
          if (message.videoData?.displayMode === 'video') {
            resetJudgeState();
          }
          break;
        default:
          break;
      }
    });

    return cleanup;
  }, []);

  const statusBadge = useMemo(() => {
    switch (status) {
      case 'running':
        return { label: 'Running', color: 'bg-green-100 text-green-800' };
      case 'paused':
        return { label: 'Paused', color: 'bg-yellow-100 text-yellow-800' };
      default:
        return { label: 'Waiting', color: 'bg-slate-100 text-slate-700' };
    }
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Judge Console</h1>
          <Link
            to="/"
            className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ← Back
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Current Word</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
            {currentWord ? (
              <div className="text-center">
                <div className="text-5xl font-bold text-slate-900 mb-2">{currentWord}</div>
                <p className="text-sm text-slate-500">Type the spelling exactly as the student says.</p>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-2xl py-6">Waiting for next word…</div>
            )}
            <div className="flex items-center justify-between text-slate-600 text-sm">
              <div>
                <p className="font-semibold text-slate-700">Time Left</p>
                <p className="text-2xl font-bold text-slate-900">{formatTime(timeLeft)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-700">Auto Submit</p>
                <p>{autoSubmitPending ? 'Enabled' : 'Waiting'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-slate-800">Spell Capture</h2>
            <textarea
              ref={textareaRef}
              value={typedWord}
              onChange={(e) => {
                const newValue = e.target.value;
                setTypedWord(newValue);
                // Update ref immediately to ensure it's always in sync
                typedWordRef.current = newValue;
              }}
              placeholder="Type the student's spelling here..."
              className="w-full h-40 border-2 border-slate-200 rounded-xl p-4 text-lg focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-400 resize-none"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  console.log('Button clicked! currentWord:', currentWord, 'currentWordRef:', currentWordRef.current);
                  console.log('typedWord (state):', typedWord);
                  console.log('typedWord (ref):', typedWordRef.current);
                  submitResult(undefined, 'manual');
                }}
                disabled={!currentWord}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold text-white transition-colors ${
                  currentWord
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed text-gray-100'
                }`}
              >
                📤 Send Result Now
              </button>
              <button
                onClick={() => {
                  setTypedWord('');
                  // Also clear ref immediately to keep them in sync
                  typedWordRef.current = '';
                }}
                className="px-4 py-3 rounded-xl font-semibold border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            </div>
            <p className="text-sm text-slate-500">
              Results are sent automatically when the timer ends or when End is pressed on the control screen.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

