import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Lazy load pages for code splitting
const MainPage = lazy(() => import('./pages/MainPage').then(m => ({ default: m.MainPage })));
const ActionPage = lazy(() => import('./pages/ActionPage').then(m => ({ default: m.ActionPage })));
const ViewPage = lazy(() => import('./pages/ViewPage').then(m => ({ default: m.ViewPage })));
const ManageScreen = lazy(() => import('./pages/ManageScreen').then(m => ({ default: m.ManageScreen })));
const JudgePage = lazy(() => import('./pages/JudgePage').then(m => ({ default: m.JudgePage })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="text-2xl font-semibold text-slate-600">Loading...</div>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/action" element={<ActionPage />} />
          <Route path="/view" element={<ViewPage />} />
          <Route path="/manage" element={<ManageScreen />} />
          <Route path="/judge" element={<JudgePage />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
