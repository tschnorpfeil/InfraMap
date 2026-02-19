import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCounter } from './StatCounter';
import { useGlobalStats } from '../hooks/useData';

export function HeroDashboard() {
    const stats = useGlobalStats();
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (search.trim()) {
            navigate(`/rankings`);
        }
    }

    return (
        <div className="hero-overlay">
            <div className="hero-overlay__card">
                <div className="hero-overlay__header">
                    <h1 className="hero-overlay__title">🚨 Infrastruktur-Alarm</h1>
                    <p className="hero-overlay__datenstand">
                        Datenstand: September 2025 · BASt
                    </p>
                </div>

                <div className="hero-overlay__stats">
                    <div className="hero-stat">
                        <span className="hero-stat__value">
                            {stats ? (
                                <StatCounter end={stats.totalBridges} />
                            ) : '—'}
                        </span>
                        <span className="hero-stat__label">Brücken</span>
                    </div>
                    <div className="hero-stat hero-stat--critical">
                        <span className="hero-stat__value">
                            {stats ? (
                                <StatCounter end={stats.criticalCount} />
                            ) : '—'}
                        </span>
                        <span className="hero-stat__label">
                            kritisch
                            {stats && <span className="hero-stat__pct"> ({stats.criticalPercent}%)</span>}
                        </span>
                    </div>
                    <div className="hero-stat">
                        <span className="hero-stat__value">
                            ∅ {stats ? (
                                <StatCounter end={new Date().getFullYear() - stats.avgBaujahr} suffix=" J." />
                            ) : '—'}
                        </span>
                        <span className="hero-stat__label">Alter</span>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="hero-overlay__search">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Landkreis suchen..."
                        className="hero-overlay__input"
                    />
                    <button type="submit" className="hero-overlay__btn">🔍</button>
                </form>
            </div>
        </div>
    );
}
