import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';

export const ViewPage: React.FC = () => {
  const [student, setStudent] = useState('');
  const [word, setWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const lastSpokenRef = useRef<number>(-1);

  const speakTime = (time: number) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(time.toString());
      utterance.rate = 0.8;
      utterance.volume = 0.8;
      utterance.pitch = 1.0;
      
      // Use a more natural voice if available
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.includes('Google')
      ) || voices.find(voice => voice.lang.startsWith('en'));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    const cleanup = broadcastManager.listen((message: QuizMessage) => {
      switch (message.type) {
        case 'update':
          if (message.data) {
            setStudent(message.data.student);
            setWord(message.data.word);
            setTimeLeft(message.data.timeLeft);
            setIsRunning(message.data.isRunning);
            setIsPaused(!message.data.isRunning);
          }
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
        case 'clear':
          setStudent('');
          setWord('');
          setTimeLeft(60);
          setIsRunning(false);
          setIsPaused(false);
          lastSpokenRef.current = -1;
          // Cancel any ongoing speech
          if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
          }
          break;
      }
    });

    return cleanup;
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

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 py-4 px-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">APIIT SPELL MASTER</h1>
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
        {student && word ? (
          <div className="text-center max-w-4xl mx-auto">
            {/* Word */}
            <div className="mb-16">
              <h2 className="text-5xl font-bold text-green-400 mb-6">Word</h2>
              <div className="text-7xl font-bold text-white bg-green-600 px-12 py-8 rounded-2xl shadow-2xl">
                {word}
              </div>
            </div>

            {/* Timer */}
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
