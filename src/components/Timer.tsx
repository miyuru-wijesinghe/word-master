import React, { useEffect, useState, useRef } from 'react';
import { soundManager } from '../utils/soundManager';
import { broadcastManager } from '../utils/broadcast';

interface TimerProps {
  duration: number;
  isRunning: boolean;
  isPaused: boolean;
  onTick: (timeLeft: number) => void;
  onEnd: () => void;
  isControlPanel?: boolean; // New prop to identify control panel
}

export const Timer: React.FC<TimerProps> = ({ 
  duration, 
  isRunning, 
  isPaused, 
  onTick, 
  onEnd,
  isControlPanel = false
}) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef<number | null>(null);
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
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          
          // Only control panel handles speech and broadcasts it
          if (isControlPanel) {
            // Speech announcements with better timing
            if (newTime === 50 || newTime === 40 || newTime === 30 || newTime === 20 || newTime === 10) {
              speakTime(newTime);
              soundManager.playWarningSound();
              // Broadcast speech to display screen
              broadcastManager.sendSpeech(newTime, true);
            } else if (newTime <= 10 && newTime > 0 && lastSpokenRef.current !== newTime) {
              speakTime(newTime);
              soundManager.playTickSound();
              lastSpokenRef.current = newTime;
              // Broadcast speech to display screen
              broadcastManager.sendSpeech(newTime, true);
            }
          }
          
          onTick(newTime);
          
          if (newTime <= 0) {
            onEnd();
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, onTick, onEnd, isControlPanel]);

  useEffect(() => {
    setTimeLeft(duration);
    lastSpokenRef.current = -1;
  }, [duration]);

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
    <div className="text-center">
      <div className={`text-6xl font-bold ${getTimerColor()} mb-4`}>
        {formatTime(timeLeft)}
      </div>
      <div className="text-lg text-gray-600">
        {isPaused ? 'Paused' : isRunning ? 'Running' : 'Stopped'}
      </div>
    </div>
  );
};
