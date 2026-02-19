import { HashRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LandkreisPage } from './pages/LandkreisPage';
import { RankingsPage } from './pages/RankingsPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/landkreis/:slug" element={<LandkreisPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
