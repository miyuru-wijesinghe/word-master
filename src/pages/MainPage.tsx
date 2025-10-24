import React from 'react';
import { Link } from 'react-router-dom';

export const MainPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl font-bold text-slate-800 mb-4">
          WordMaster
        </h1>
        <p className="text-xl text-slate-600 mb-12">
          Live word explanation game
        </p>
        
        <div className="space-y-4 mb-12">
          <Link
            to="/action"
            className="block w-full max-w-sm mx-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 hover:scale-105 shadow-lg"
          >
            🎮 Control Panel
          </Link>
          
          <Link
            to="/view"
            className="block w-full max-w-sm mx-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 hover:scale-105 shadow-lg"
          >
            📺 Display Screen
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm text-left">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">How to play:</h3>
          <ol className="space-y-2 text-slate-600">
            <li><strong>1.</strong> Open Control Panel in one tab</li>
            <li><strong>2.</strong> Open Display Screen in another tab</li>
            <li><strong>3.</strong> Upload Excel file with student names and words</li>
            <li><strong>4.</strong> Select a student and start the timer</li>
            <li><strong>5.</strong> Student explains the word in 60 seconds</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
