import React from 'react';
import { Link } from 'react-router-dom';

export const MainPage: React.FC = () => {
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay with opacity */}
      <div className="absolute inset-0 bg-black bg-opacity-60"></div>
      
      {/* Background Words */}
      <div className="absolute inset-0 opacity-20 pointer-events-none z-10">
        <div className="absolute top-10 left-10 text-6xl font-bold text-white transform rotate-12">SPELL</div>
        <div className="absolute top-20 right-20 text-5xl font-bold text-white transform -rotate-12">MASTER</div>
        <div className="absolute top-40 left-1/4 text-4xl font-bold text-white transform rotate-6">WORDS</div>
        <div className="absolute top-60 right-1/3 text-5xl font-bold text-white transform -rotate-6">CHALLENGE</div>
        <div className="absolute bottom-40 left-20 text-4xl font-bold text-white transform rotate-12">LEARN</div>
        <div className="absolute bottom-20 right-10 text-6xl font-bold text-white transform -rotate-12">GAME</div>
        <div className="absolute bottom-60 left-1/2 text-3xl font-bold text-white transform rotate-3">VOCABULARY</div>
        <div className="absolute top-1/2 left-10 text-4xl font-bold text-white transform -rotate-8">SKILLS</div>
        <div className="absolute top-1/3 right-10 text-5xl font-bold text-white transform rotate-15">EDUCATION</div>
      </div>
      
      <div className="text-center max-w-2xl relative z-20">
        <h1 className="text-6xl font-bold text-white mb-12 drop-shadow-lg">
          APIIT SPELL MASTER
        </h1>
        
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
        
        <div className="bg-white bg-opacity-95 p-6 rounded-xl shadow-sm text-left">
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
