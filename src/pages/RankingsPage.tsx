import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RankingsTable } from '../components/RankingsTable';
import { BarChartIcon } from '../components/Icons';

export function RankingsPage() {
    useEffect(() => {
        document.title = 'Ranking — Landkreise nach Zustandsnote | Brückenzeugnis';
    }, []);

    return (
        <div className="page page--rankings page--overlay overlay-modal">
            <div className="rankings-page__header">
                <Link to="/" className="back-link">← Zurück zur Karte</Link>
                <h1 className="rankings-page__title">
                    <BarChartIcon style={{ width: 32, height: 32, marginRight: 12, display: 'inline-block', verticalAlign: 'text-bottom' }} /> Ranking
                </h1>
                <p className="rankings-page__subtitle">
                    Ranking aller Landkreise nach Brückenzustand — sortierbar, filterbar
                </p>
            </div>
            <RankingsTable />
        </div>
    );
}
