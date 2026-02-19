import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RankingsTable } from '../components/RankingsTable';

export function RankingsPage() {
    useEffect(() => {
        document.title = 'Schandmauer — Die marödesten Landkreise | InfraMap';
    }, []);

    return (
        <div className="page page--rankings">
            <div className="rankings-page__header">
                <Link to="/" className="back-link">← Karte</Link>
                <h1 className="rankings-page__title">
                    🏆 Schandmauer
                </h1>
                <p className="rankings-page__subtitle">
                    Ranking aller Landkreise nach Brückenzustand — sortierbar, filterbar
                </p>
            </div>
            <RankingsTable />
        </div>
    );
}
