import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { DataProvider } from './contexts/DataProvider';
import { HomePage } from './pages/HomePage';
import { LandkreisPage } from './pages/LandkreisPage';
import { RankingsPage } from './pages/RankingsPage';

function AppHeader() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        🌉 <span>Brückenzeugnis</span>
      </Link>
      <nav className="app-header__nav">
        <Link
          to="/rankings"
          className={`app-header__link ${location.pathname === '/rankings' ? 'app-header__link--active' : ''}`}
        >
          📊 Ranking
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

import { BridgeMap } from './components/BridgeMap';
import { BridgeDetailsOverlay } from './components/BridgeDetailsOverlay';

function App() {
  return (
    <HashRouter>
      <DataProvider>
        <div className="app-layout">
          {/* Background Map Layer */}
          <div className="app-layout__map">
            <BridgeMap className="global-map" />
          </div>

          {/* Foreground UI Layer */}
          <div className="app-layout__ui">
            <AppHeader />
            <BridgeDetailsOverlay />
            <div className="app-layout__content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/landkreis/:slug" element={<LandkreisPage />} />
                <Route path="/rankings" element={<RankingsPage />} />
              </Routes>
            </div>
          </div>
        </div>
      </DataProvider>
    </HashRouter>
  );
}

export default App;

