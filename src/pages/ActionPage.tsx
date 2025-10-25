import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { Timer } from '../components/Timer';
import { parseExcelFile } from '../utils/excelParser';
import type { QuizRow } from '../utils/excelParser';
import { broadcastManager } from '../utils/broadcast';
import type { QuizMessage } from '../utils/broadcast';
import { soundManager } from '../utils/soundManager';
import * as XLSX from 'xlsx';

export const ActionPage: React.FC = () => {
  const [quizData, setQuizData] = useState<QuizRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [startedRow, setStartedRow] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentStudent, setCurrentStudent] = useState('');
  const [currentWord, setCurrentWord] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle row selection (toggle)
  const handleSelectRow = (index: number) => {
    setSelectedRows(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  // Handle row updates from dropdowns
  const handleUpdateRow = (index: number, field: keyof QuizRow, value: string) => {
    setQuizData(prevData => {
      const newData = prevData.map((row, i) => {
        if (i === index) {
          const updatedRow = { ...row, [field]: value };
          
          // If team changes, reset the name to empty (optional)
          if (field === 'Team') {
            updatedRow.StudentName = '';
          }
          
          return updatedRow;
        }
        return row;
      });
      return newData;
    });
  };

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
  }, [selectedRows, isRunning, isPaused]);

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
      setSelectedRows([]);
      setStartedRow(null);
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
    if (selectedRows.length === 0) {
      alert('Please select at least one row first');
      return;
    }

    // Use the last selected row (most recently selected)
    const lastSelectedIndex = selectedRows[selectedRows.length - 1];
    const selectedData = quizData[lastSelectedIndex];
    
    setCurrentStudent(selectedData.StudentName);
    setCurrentWord(selectedData.Word);
    setStartedRow(lastSelectedIndex);
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
    setStartedRow(null);
    // Don't clear selectedRows - keep them in bottom table

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
    setStartedRow(null);
    
    // Broadcast end
    broadcastManager.send({ type: 'end' });
  };

  // Save selected data as new Excel file
  const handleSaveData = () => {
    try {
      console.log('Save Data clicked');
      console.log('Selected rows:', selectedRows);
      console.log('Quiz data length:', quizData.length);
      
      if (selectedRows.length === 0) {
        alert('No selected entries to save. Please select some rows first.');
        return;
      }

      // Get only the selected entries
      const selectedData = selectedRows.map(index => {
        const row = quizData[index];
        console.log(`Row ${index}:`, row);
        return row;
      });

      console.log('Selected data to save:', selectedData);

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(selectedData);

      // Add worksheet to workbook (Excel sheet names max 31 chars)
      XLSX.utils.book_append_sheet(wb, ws, 'Selected Data');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `selected-spelling-challenge-${timestamp}.xlsx`;

      console.log('Saving file:', filename);

      // Save file
      XLSX.writeFile(wb, filename);
      
      console.log('File saved successfully');
      
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`❌ Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
              onClick={handleSaveData}
              disabled={selectedRows.length === 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              💾 Save Data
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
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Spelling Challenge Roster</h2>
          <DataTable
            data={quizData}
            selectedRows={selectedRows}
            startedRow={startedRow}
            onSelectRow={handleSelectRow}
            onUpdateRow={handleUpdateRow}
          />
        </div>

        {/* Selected Data Form */}
        {selectedRows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Selected Entries ({selectedRows.length} selected)
            </h2>
            
            {/* Display all selected entries as table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Word
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Round
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedRows.map((rowIndex, index) => {
                    const row = quizData[rowIndex];
                    return (
                      <tr 
                        key={rowIndex} 
                        className={`hover:bg-gray-50 transition-colors duration-200 ${
                          startedRow === rowIndex
                            ? 'bg-green-100 border-l-4 border-green-500 shadow-md'
                            : 'hover:shadow-sm'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row?.Word}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row?.Team}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row?.StudentName || '-- Not Selected --'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row?.Round}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            startedRow === rowIndex
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {startedRow === rowIndex ? 'Running' : 'Selected'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleStart}
            disabled={selectedRows.length === 0 || isRunning}
            className={`w-14 h-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center text-white font-bold ${
              selectedRows.length === 0 || isRunning
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 hover:scale-110'
            }`}
            title="Start Challenge"
          >
            ▶️
          </button>
          <span className="text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">Play</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handlePause}
            disabled={!isRunning}
            className={`w-14 h-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center text-white font-bold ${
              !isRunning
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-yellow-600 hover:bg-yellow-700 hover:scale-110'
            }`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
          <span className="text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">Pause</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleEnd}
            disabled={!isRunning && !isPaused}
            className={`w-14 h-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center text-white font-bold ${
              !isRunning && !isPaused
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 hover:scale-110'
            }`}
            title="End Challenge"
          >
            ⏹️
          </button>
          <span className="text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">End</span>
        </div>
      </div>
    </div>
  );
};
