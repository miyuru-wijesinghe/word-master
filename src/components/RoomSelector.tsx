import React, { useState, useEffect } from 'react';
import { broadcastManager } from '../utils/broadcast';

export const RoomSelector: React.FC = () => {
  const [currentRoom, setCurrentRoom] = useState<string>(broadcastManager.getRoomId());
  const [isOpen, setIsOpen] = useState(false);
  const [customRoom, setCustomRoom] = useState('');

  useEffect(() => {
    // Update current room when it changes externally
    const checkRoom = () => {
      setCurrentRoom(broadcastManager.getRoomId());
    };
    
    // Check periodically in case room changes elsewhere
    const interval = setInterval(checkRoom, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRoomChange = (roomId: string) => {
    if (roomId.trim()) {
      broadcastManager.setRoomId(roomId.trim());
      setCurrentRoom(roomId.trim());
      setIsOpen(false);
      setCustomRoom('');
    }
  };

  const handleCustomRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customRoom.trim()) {
      handleRoomChange(customRoom.trim());
    }
  };

  const presetRooms = [
    'default-room',
    'room-1',
    'room-2',
    'room-3',
    'room-4',
    'room-5',
  ];

  const isFirebaseEnabled = broadcastManager.isFirebaseEnabled();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          isFirebaseEnabled
            ? 'bg-green-100 hover:bg-green-200 text-green-800 border border-green-300'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'
        }`}
        title={isFirebaseEnabled ? 'Multi-device sync enabled' : 'Single-device mode'}
      >
        <div className={`w-2 h-2 rounded-full ${isFirebaseEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
        <span>Room: {currentRoom}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute top-full mt-2 right-0 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[280px]">
            <div className="p-4">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Room
                </label>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                  {currentRoom}
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preset Rooms
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {presetRooms.map((room) => (
                    <button
                      key={room}
                      onClick={() => handleRoomChange(room)}
                      className={`px-3 py-2 text-sm rounded border transition-colors ${
                        currentRoom === room
                          ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {room}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Room
                </label>
                <form onSubmit={handleCustomRoomSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={customRoom}
                    onChange={(e) => setCustomRoom(e.target.value)}
                    placeholder="Enter room name"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Set
                  </button>
                </form>
              </div>

              {!isFirebaseEnabled && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  ⚠️ Firebase not configured. Room selection won't sync across devices.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};



