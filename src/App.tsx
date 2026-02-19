import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LandkreisPage } from './pages/LandkreisPage';
import { RankingsPage } from './pages/RankingsPage';

function AppHeader() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        🚨 <span>InfraMap</span>
      </Link>
      <nav className="app-header__nav">
        <Link
          to="/rankings"
          className={`app-header__link ${location.pathname === '/rankings' ? 'app-header__link--active' : ''}`}
        >
          🏆 Schandmauer
        </Link>
        {!isHome && (
          <Link to="/" className="app-header__link">
            🗺️ Karte
          </Link>
        )}
      </nav>
    </header>
  );
}

function App() {
  return (
    <HashRouter>
      <AppHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/landkreis/:slug" element={<LandkreisPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
