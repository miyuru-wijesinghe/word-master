# WordMaster - Live Word Game

A real-time synchronized word explanation game built with React + Vite + TypeScript + Tailwind CSS.

## 🎯 Features

- **Real-time synchronization** using BroadcastChannel API (no backend required)
- **Excel file upload** and parsing for game data
- **60-second countdown timer** with synchronized voice announcements
- **Control panel** for game management
- **Display screen** for projector/audience viewing
- **Sound effects** and keyboard shortcuts
- **Responsive design** with Tailwind CSS

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## 📖 How to Play

### 1. Main Page (`/`)
- Choose between "Control Panel" or "Display Screen"

### 2. Control Panel (`/action`)
- **Upload Excel**: Click to upload a `.xlsx` file with game data
- **Select Student**: Click "Select" on any row in the table
- **Start**: Begin the 60-second countdown for the selected student/word
- **Pause/Resume**: Pause or resume the current timer
- **End**: Stop the timer and clear the display

### 3. Display Screen (`/view`)
- Displays the current student name, word, and countdown timer
- Updates in real-time when the control panel manages the game
- Optimized for projector/screen display with large, readable text
- Synchronized voice announcements

## 📊 Excel File Format

Your Excel file should have the following columns:
- **Round**: Round identifier (e.g., "Round1", "Round2")
- **StudentName**: Student's name
- **Word**: The word for the student to explain/describe

Example:
```
Round | StudentName | Word
Round1 | Alice | Algorithm
Round1 | Bob | Database
Round2 | Charlie | Function
```

## 🎤 Voice & Sound Features

The timer includes automatic synchronized voice announcements:
- Speaks at 50s, 40s, 30s, 20s, 10s
- Counts down every second for the last 10 seconds
- Uses the browser's built-in Web Speech API
- **Perfectly synchronized** between control panel and display screen

## ⌨️ Keyboard Shortcuts

- `Ctrl+U` - Upload Excel file
- `Ctrl+S` - Start timer
- `Ctrl+P` - Pause/Resume timer
- `Ctrl+E` - End timer

## 🔄 Real-Time Sync

The app uses the BroadcastChannel API to synchronize between tabs:
- Open `/action` in one tab (control panel)
- Open `/view` in another tab (display screen)
- Both tabs stay synchronized in real-time
- Voice announcements sync perfectly
- No internet connection required (works locally)

## 🛠️ Technical Details

### Built With
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **xlsx** library for Excel file parsing
- **BroadcastChannel API** for real-time communication
- **Web Speech API** for synchronized voice announcements
- **Web Audio API** for sound effects

### Project Structure
```
src/
├── components/
│   ├── DataTable.tsx    # Table component for game data
│   └── Timer.tsx        # Countdown timer with voice
├── pages/
│   ├── MainPage.tsx     # Landing page with navigation
│   ├── ActionPage.tsx   # Control panel
│   └── ViewPage.tsx     # Display screen
├── utils/
│   ├── excelParser.ts   # Excel file parsing logic
│   ├── broadcast.ts     # BroadcastChannel wrapper
│   └── soundManager.ts  # Sound effects manager
├── App.tsx              # Main app with routing
└── main.tsx             # React entry point
```

## 🎨 UI Features

- **Clean, modern design** with simplified interface
- **Large, readable text** optimized for projectors
- **Color-coded timer** (green → orange → red as time runs out)
- **Smooth animations** and hover effects
- **Responsive design** that works on all screen sizes

## 🧪 Testing

1. Start the dev server: `npm run dev`
2. Open two browser tabs:
   - Tab 1: `http://localhost:5173/action`
   - Tab 2: `http://localhost:5173/view`
3. Upload the sample Excel file (`sample-quiz-data.csv`)
4. Select a student and click "Start"
5. Watch both tabs sync in real-time with perfect voice synchronization!

## 📝 License

This project is open source and available under the MIT License.
