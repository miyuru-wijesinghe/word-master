import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainPage } from './pages/MainPage';
import { ActionPage } from './pages/ActionPage';
import { ViewPage } from './pages/ViewPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/action" element={<ActionPage />} />
        <Route path="/view" element={<ViewPage />} />
      </Routes>
    </Router>
  );
}

export default App;
