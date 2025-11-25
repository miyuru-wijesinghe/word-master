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

  const resetJudgeState = () => {
    stopCountdown();
    timerEndTimestampRef.current = null;
    setCurrentWord('');
    setTypedWord('');
    setTimeLeft(0);
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

    const capturedTyped =
      trigger === 'manual' ? typedWord.trim() : typedWordRef.current.trim();
    const normalizedActual = normalizeWord(resolvedWord);
    const normalizedTyped = normalizeWord(capturedTyped);
    const isCorrect =
      normalizedActual.length > 0 &&
      normalizedTyped.length > 0 &&
      normalizedActual === normalizedTyped;

    const displayTyped = capturedTyped || '—';
    const signature = `${resolvedWord.toLowerCase()}::${displayTyped.toLowerCase()}::${trigger}`;

    if (trigger === 'auto' && signature === lastSubmittedSignatureRef.current) {
      return;
    }
    lastSubmittedSignatureRef.current = signature;

    // Always send judge result - this is the main message that displays on view screen
    const judgeMessage: QuizMessage = {
      type: 'judge',
      judgeData: {
        actualWord: resolvedWord,
        typedWord: displayTyped,
        isCorrect
      }
    };
    
    console.log('Sending judge result:', judgeMessage);
    console.log('BroadcastChannel available:', typeof BroadcastChannel !== 'undefined');
    broadcastManager.send(judgeMessage);
    console.log('Judge result sent via broadcastManager');

    // For manual submissions, send control 'end' to stop timer
    // But delay it slightly to ensure judge message is processed first
    if (trigger === 'manual') {
      setTimeout(() => {
        broadcastManager.send({
          type: 'control',
          control: {
            action: 'end'
          }
        });
      }, 200);
    }

    // Clear state after sending messages
    stopCountdown();
    timerEndTimestampRef.current = null;
    setStatus('waiting');
    setTimeLeft(0);
    setCurrentWord('');
    setTypedWord('');

    setAutoSubmitPending(false);
  };

  useEffect(() => {
    const cleanup = broadcastManager.listen((message: QuizMessage) => {
      switch (message.type) {
        case 'update':
          if (!message.data) break;
          {
            const incomingWord = message.data.word;
            const isTimerRunning = !!message.data.isRunning;
            const incomingTimeLeftRaw = message.data.timeLeft;
            const incomingTimeLeft =
              typeof incomingTimeLeftRaw === 'number' ? incomingTimeLeftRaw : timeLeft;

            if (incomingWord && incomingWord !== currentWordRef.current) {
              setCurrentWord(incomingWord);
              setTypedWord('');
            }

            if (isTimerRunning) {
              const targetEndsAt =
                (message.data as { endsAt?: number }).endsAt ??
                (Date.now() + incomingTimeLeft * 1000);
              timerEndTimestampRef.current = targetEndsAt;
              const effectiveTimeLeft = Math.max(
                0,
                Math.floor((targetEndsAt - Date.now()) / 1000)
              );
              setTimeLeft(effectiveTimeLeft);
              setStatus('running');
              setAutoSubmitPending(true);
              startCountdown();
            } else {
              timerEndTimestampRef.current = (message.data as { endsAt?: number }).endsAt ?? null;
              stopCountdown();
              const displayTime = incomingTimeLeft >= 0 ? incomingTimeLeft : 0;
              setTimeLeft(displayTime);
              setStatus(displayTime > 0 ? 'paused' : 'waiting');
              setAutoSubmitPending(false);
            }
          }
          break;
        case 'pause':
          stopCountdown();
          timerEndTimestampRef.current = (message.data as { endsAt?: number })?.endsAt ?? null;
          if (typeof message.data?.timeLeft === 'number') {
            setTimeLeft(message.data.timeLeft > 0 ? message.data.timeLeft : 0);
          }
          setStatus('paused');
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

  useEffect(() => {
    return () => {
      stopCountdown();
    };
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
              value={typedWord}
              onChange={(e) => setTypedWord(e.target.value)}
              placeholder="Type the student's spelling here..."
              className="w-full h-40 border-2 border-slate-200 rounded-xl p-4 text-lg focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-400 resize-none"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  console.log('Button clicked! currentWord:', currentWord, 'currentWordRef:', currentWordRef.current);
                  console.log('typedWord:', typedWord);
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
                onClick={() => setTypedWord('')}
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

