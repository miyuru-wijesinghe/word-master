import React, { useEffect, useState, useRef } from 'react';
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
  const lastBeepRef = useRef<number>(-1);

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          
          // Only control panel broadcasts beep cues (sounds play on ViewPage)
          if (isControlPanel) {
            if (
              newTime === 50 ||
              newTime === 40 ||
              newTime === 30 ||
              newTime === 20 ||
              newTime === 10
            ) {
              if (lastBeepRef.current !== newTime) {
                broadcastManager.sendSpeech(newTime, true);
                lastBeepRef.current = newTime;
              }
            } else if (newTime <= 10 && newTime > 0 && lastBeepRef.current !== newTime) {
              lastBeepRef.current = newTime;
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
    lastBeepRef.current = -1;
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
