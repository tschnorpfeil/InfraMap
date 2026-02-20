import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { DataProvider } from './contexts/DataProvider';
import { HomePage } from './pages/HomePage';
import { LandkreisPage } from './pages/LandkreisPage';
import { RankingsPage } from './pages/RankingsPage';
import { useBridgesGeoJSON } from './hooks/useData';

import { BridgeMap } from './components/BridgeMap';
import { BridgeDetailsOverlay } from './components/BridgeDetailsOverlay';
import { BridgeIcon } from './components/BridgeIcon';
import { MapIcon, BarChartIcon } from './components/Icons';

function AppHeader() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <BridgeIcon style={{ width: 24, height: 24, marginRight: 4 }} /> <span>Brückenzeugnis</span>
      </Link>
      <nav className="app-header__nav">
        <Link
          to="/rankings"
          className={`app-header__link ${location.pathname === '/rankings' ? 'app-header__link--active' : ''}`}
        >
          <BarChartIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Ranking
        </Link>
        {!isHome && (
          <Link to="/" className="app-header__link">
            <MapIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Karte
          </Link>
        )}
      </nav>
    </header>
  );
}

/** Live progress counter shown while bridges are streaming in */
function BridgeLoadProgress() {
  const { loading, progress } = useBridgesGeoJSON();

  if (!loading || progress.loaded === 0) return null;

  return (
    <div className="bridge-map__scan-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {progress.loaded < 5000 ? (
        <><div className="progress-dot progress-dot--red" /> {progress.loaded.toLocaleString('de-DE')} kritische Brücken geladen…</>
      ) : progress.loaded < 20000 ? (
        <><div className="progress-dot progress-dot--yellow" /> {progress.loaded.toLocaleString('de-DE')} / ~40.000 Brücken…</>
      ) : (
        <><div className="progress-dot progress-dot--green" /> {progress.loaded.toLocaleString('de-DE')} / ~40.000 Brücken…</>
      )}
    </div>
  );
}

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
            <BridgeLoadProgress />
            <BridgeDetailsOverlay />
            <main className="app-layout__content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/landkreis/:slug" element={<LandkreisPage />} />
                <Route path="/rankings" element={<RankingsPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </DataProvider>
    </HashRouter>
  );
}

export default App;


