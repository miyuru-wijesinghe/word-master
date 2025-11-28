# AI Agent Instructions for WordMaster Quiz App

## Architecture Overview

**WordMaster** is a real-time synchronized word quiz game built with React 18 + Vite + TypeScript. It has two core runtime modes:

1. **ActionPage** (`/action`) - Control panel: uploads Excel data, manages timer, judges student responses
2. **ViewPage** (`/view`) - Display screen: shows student names, words, and live countdown timer

### Multi-Layer Sync Architecture

The app uses **layered synchronization** for reliability:

1. **BroadcastChannel API** (same-device, within-browser): Fastest sync between tabs on same machine
2. **Firebase Realtime Database** (cross-device): Syncs between different machines/users in same room
3. **Firestore** (persistent storage): Stores quiz definitions and historical entries

Key file: `src/utils/broadcast.ts` - The `BroadcastManager` orchestrates both layers. Messages flow through a unified `QuizMessage` interface defined in this file.

## Critical Data Flows

### Timer Synchronization (Most Complex)

```
ActionPage (Timer starts)
  → Timer.tsx broadcasts speech cues at 50/40/30/20/10/9.../1 seconds
  → broadcastManager.sendSpeech() sends to ViewPage + Firebase
  → ViewPage receives and plays audio beeps + voice via Web Speech API
  → Both pages display synchronized countdown
```

**Key pattern**: The control panel (ActionPage) is the source of truth for timer state. ViewPage renders based on received messages, not its own timer.

### Excel Upload & Data Management

`excelParser.ts` has sophisticated **flexible header matching** (case-insensitive, partial matches):
- Required columns: Team, Word, Pronunciation, Meaning, WordOrigin, WordInContext
- Cleans word values: removes numbering patterns like "1. Astral" → "Astral"
- Handles empty rows and team name carryover across rows

### Judge Result Display

ActionPage receives spelling judgments from JudgePage and broadcasts via `judgeData`. ViewPage displays results with specific timing:
- `RESULT_DELAY_MS = 5000` - delay before showing result
- `RESULT_DISPLAY_MS = 10000` - how long to display result
- Prevents duplicate display cycles with `activeResultWordRef`

## Component Relationships

- **Timer.tsx**: Stateful timer that broadcasts speech cues. Receives `duration`, `isRunning`, `isPaused` props. Only control panel should set `isControlPanel={true}` to broadcast.
- **DataTable.tsx**: Renders quiz data rows with selection/action UI
- **RoomSelector.tsx**: Firebase room selection for cross-device sync
- **ActionPage.tsx**: Main control hub (1600+ lines) - manages Firestore quiz CRUD, timer control, Excel upload
- **ViewPage.tsx**: Display rendering (1300+ lines) - handles message reception, judge result display, audio playback

## Build & Development

### Commands
```bash
npm run dev           # Start Vite dev server (http://127.0.0.1:5173)
npm run build         # TypeScript check + Vite build
npm run test:puppeteer # Run Playwright tests
```

### Code Splitting (Vite)
- Pages are lazy-loaded via `React.lazy()` with fallback loading component
- Dependencies split into vendor chunks: `react-vendor`, `firebase-vendor`, `utils-vendor`
- See `vite.config.js` for `manualChunks` configuration

### TypeScript Config
- Strict mode enabled, ES2022 target
- No unused variables/parameters allowed
- Common in `src/types/` (if any custom types exist)

## Testing Strategy

**Playwright** (`playwright.config.ts`):
- Base URL: `http://127.0.0.1:5173`
- Runs against locally-served dev instance
- Test files: `test-*.spec.ts` in root
- Key test scenarios: timer freeze, judge result reliability, view idle modes

**No Jest/unit tests** - focus is on E2E integration tests.

## Firebase Integration (Optional Cross-Device Sync)

### Configuration
- `firebaseConfig.ts` - Initializes Firebase with environment variables as fallback
- Falls back to BroadcastChannel-only if Firebase config unavailable
- Uses both Realtime Database (message sync) and Firestore (quiz storage)

### Environment Variables (if using Firebase)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_ROOM_ID (optional, defaults to 'default-room')
```

## Project-Specific Patterns

### 1. Message Broadcasting Pattern
All cross-component communication uses `QuizMessage` type:
```typescript
interface QuizMessage {
  type: 'update' | 'pause' | 'end' | 'clear' | 'speech' | 'control' | 'video' | 'judge';
  data?: { /* timer/display data */ };
  speechData?: { timeLeft: number; shouldSpeak: boolean };
  judgeData?: { actualWord: string; typedWord: string; isCorrect: boolean };
  sentAt: number; // Timestamp for deduplication
}
```

### 2. State Management Approach
- No Redux/Context API - direct `useState` hooks
- `useRef` for non-render state (timers, refs, tracking flags)
- Cleanup functions in `useEffect` returns for subscriptions

### 3. Styling
- Tailwind CSS utilities only (no CSS modules or styled-components)
- Color progression for timer: green (>30s) → orange (>10s) → red (≤10s)
- Responsive design via standard Tailwind breakpoints

### 4. Sound Effects
`soundManager.ts` uses **Web Audio API** with singleton pattern:
- `playStartSound()`, `playEndSound()`, `playCountdownBeep()`, etc.
- Lazy initializes AudioContext on first user interaction
- Handles browser suspend states

### 5. Timer State Refs (ViewPage Complexity)
ViewPage uses extensive refs to prevent state flashing:
- `shouldShowTimerRef`, `shouldShowResultRef` - track what to display
- `clearedResultWordsRef` - Set of words whose results were shown to prevent reappearing
- `activeResultWordRef` - prevents multiple result cycles for same word
- This pattern prevents unnecessary re-renders during async state transitions

## File Organization

```
src/
├── App.tsx                    # Route definitions (lazy-loaded pages)
├── components/
│   ├── DataTable.tsx         # Quiz table UI
│   ├── Timer.tsx             # Countdown component with speech beeps
│   └── RoomSelector.tsx      # Firebase room selection
├── pages/
│   ├── MainPage.tsx          # Landing page (/): navigation hub
│   ├── ActionPage.tsx        # Control panel (/action): main hub, Firestore CRUD
│   ├── ViewPage.tsx          # Display screen (/view): rendering + audio playback
│   ├── ManageScreen.tsx      # Quiz management (Firestore entries)
│   └── JudgePage.tsx         # Spelling judge (/judge)
├── utils/
│   ├── broadcast.ts          # BroadcastManager + Firebase sync orchestration
│   ├── excelParser.ts        # Excel file parsing with flexible headers
│   ├── firebaseConfig.ts     # Firebase initialization
│   ├── firebaseSync.ts       # Firebase Realtime DB wrapper
│   ├── firestoreManager.ts   # Firestore quiz/entry CRUD
│   └── soundManager.ts       # Web Audio API sound effects
└── types/                     # (Custom TypeScript types if any)
```

## When Adding Features

1. **Cross-tab sync needed?** Add new message type to `QuizMessage` interface in `broadcast.ts`
2. **Persisting quiz data?** Use `firestoreManager` for database operations
3. **Excel import changes?** Update column mappings in `excelParser.ts` (flexible header matching logic)
4. **New audio cue?** Add method to `soundManager.ts` following singleton pattern
5. **New page?** Add lazy route in `App.tsx` with Suspense fallback
6. **Timer-related changes?** Coordinate with Timer.tsx speech broadcast + ViewPage audio playback

## Known Complexity Areas

- **ViewPage state management**: Heavy use of refs for rendering control due to async result display timing
- **Excel parsing**: Flexible header matching requires careful testing of various formats
- **Cross-device sync**: Firebase integration adds latency; BroadcastChannel is instant but same-device only
- **Audio sync**: Web Speech API inconsistencies across browsers; test on target deployment environment

## Debugging Tips

- Check browser console for `BroadcastChannel` and `Firebase` messages (verbose logging enabled)
- ViewPage has many timing-related refs; trace state through `shouldShowTimerRef`/`shouldShowResultRef`
- For timer desync: verify `sentAt` timestamps in messages to catch duplicate processing
- For audio issues: ensure AudioContext is resumed and Web Speech API available in browser
