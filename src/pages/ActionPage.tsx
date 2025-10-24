import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { Timer } from '../components/Timer';
import { parseExcelFile } from '../utils/excelParser';
import type { QuizRow } from '../utils/excelParser';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
import { soundManager } from '../utils/soundManager';

export const ActionPage: React.FC = () => {
  const [quizData, setQuizData] = useState<QuizRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentStudent, setCurrentStudent] = useState('');
  const [currentWord, setCurrentWord] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 's':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleStart();
          }
          break;
        case 'p':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handlePause();
          }
          break;
        case 'e':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleEnd();
          }
          break;
        case 'u':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            fileInputRef.current?.click();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedRow, isRunning, isPaused]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    try {
      const data = await parseExcelFile(file);
      if (data.length === 0) {
        alert('No valid data found in the Excel file');
        return;
      }
      setQuizData(data);
      setSelectedRow(null);
      setIsRunning(false);
      setIsPaused(false);
      setTimeLeft(60);
      setCurrentStudent('');
      setCurrentWord('');
    } catch (error) {
      alert(`Error parsing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStart = () => {
    if (selectedRow === null) {
      alert('Please select a row first');
      return;
    }

    const selectedData = quizData[selectedRow];
    setCurrentStudent(selectedData.StudentName);
    setCurrentWord(selectedData.Word);
    setTimeLeft(60);
    setIsRunning(true);
    setIsPaused(false);

    // Play start sound
    soundManager.playStartSound();

    // Broadcast to view page
    const message: QuizMessage = {
      type: 'update',
      data: {
        student: selectedData.StudentName,
        word: selectedData.Word,
        timeLeft: 60,
        isRunning: true
      }
    };
    broadcastManager.send(message);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    
    // Play pause sound
    soundManager.playPauseSound();
    
    const message: QuizMessage = {
      type: isPaused ? 'update' : 'pause',
      data: {
        student: currentStudent,
        word: currentWord,
        timeLeft,
        isRunning: !isPaused
      }
    };
    broadcastManager.send(message);
  };

  const handleEnd = () => {
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(60);
    setCurrentStudent('');
    setCurrentWord('');
    setSelectedRow(null);

    // Play end sound
    soundManager.playEndSound();

    // Broadcast end to view page
    broadcastManager.send({ type: 'end' });
  };

  const handleTimerTick = (newTimeLeft: number) => {
    setTimeLeft(newTimeLeft);
    
    // Broadcast update
    const message: QuizMessage = {
      type: 'update',
      data: {
        student: currentStudent,
        word: currentWord,
        timeLeft: newTimeLeft,
        isRunning: true
      }
    };
    broadcastManager.send(message);
  };

  const handleTimerEnd = () => {
    setIsRunning(false);
    setIsPaused(false);
    
    // Broadcast end
    broadcastManager.send({ type: 'end' });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-slate-900">Control Panel</h1>
            <Link
              to="/"
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              📁 Upload Excel
            </button>
            <button
              onClick={handleStart}
              disabled={selectedRow === null || isRunning}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              ▶️ Start
            </button>
            <button
              onClick={handlePause}
              disabled={!isRunning}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <button
              onClick={handleEnd}
              disabled={!isRunning && !isPaused}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              ⏹️ End
            </button>
          </div>

          {/* Keyboard Shortcuts Help */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Keyboard Shortcuts:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600">
              <div><kbd className="px-2 py-1 bg-slate-200 rounded">Ctrl+U</kbd> Upload</div>
              <div><kbd className="px-2 py-1 bg-slate-200 rounded">Ctrl+S</kbd> Start</div>
              <div><kbd className="px-2 py-1 bg-slate-200 rounded">Ctrl+P</kbd> Pause</div>
              <div><kbd className="px-2 py-1 bg-slate-200 rounded">Ctrl+E</kbd> End</div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Timer Display */}
          {(isRunning || isPaused) && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <Timer
                duration={60}
                isRunning={isRunning}
                isPaused={isPaused}
                onTick={handleTimerTick}
                onEnd={handleTimerEnd}
                isControlPanel={true}
              />
            </div>
          )}

          {/* Current Selection */}
          {currentStudent && currentWord && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Current Round:</h3>
              <p className="text-blue-700">
                <strong>Word:</strong> {currentWord}
              </p>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Game Participants</h2>
          <DataTable
            data={quizData}
            selectedRow={selectedRow}
            onSelectRow={setSelectedRow}
          />
        </div>
      </div>
    </div>
  );
};
