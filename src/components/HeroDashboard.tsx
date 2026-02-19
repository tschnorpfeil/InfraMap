import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCounter } from './StatCounter';
import { useGlobalStats } from '../hooks/useData';
import { SONDERVERMOEGEN_TOTAL, SONDERVERMOEGEN_BRUECKEN_FREIGEGEBEN } from '../utils/constants';
import { slugify } from '../utils/grading';

export function HeroDashboard() {
    const stats = useGlobalStats();
    const [plz, setPlz] = useState('');
    const navigate = useNavigate();

    const sondervermoegen_percent = Math.round(
        (SONDERVERMOEGEN_BRUECKEN_FREIGEGEBEN / SONDERVERMOEGEN_TOTAL) * 1000
    ) / 10;

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (plz.trim()) {
            navigate(`/rankings`);
        }
    }

    return (
        <div className="hero-dashboard">
            <div className="hero-dashboard__alarm">
                <div className="alarm-icon">🚨</div>
                <h1 className="hero-dashboard__title">Infrastruktur-Alarm</h1>
                <p className="hero-dashboard__subtitle">
                    Zustand deutscher Brücken — datenbasiert, transparent, alarmierend
                </p>
            </div>

            <div className="hero-dashboard__stats">
                <div className="stat-card stat-card--total">
                    <div className="stat-card__value">
                        {stats ? (
                            <StatCounter end={stats.totalBridges} />
                        ) : (
                            <span className="loading-pulse">—</span>
                        )}
                    </div>
                    <div className="stat-card__label">Brücken erfasst</div>
                </div>

                <div className="stat-card stat-card--critical">
                    <div className="stat-card__value stat-card__value--alarm">
                        {stats ? (
                            <StatCounter end={stats.criticalCount} />
                        ) : (
                            <span className="loading-pulse">—</span>
                        )}
                    </div>
                    <div className="stat-card__label">
                        in kritischem Zustand
                        {stats && (
                            <span className="stat-card__percent">
                                ({stats.criticalPercent}%)
                            </span>
                        )}
                    </div>
                </div>

                <div className="stat-card stat-card--age">
                    <div className="stat-card__value">
                        ∅{' '}
                        {stats ? (
                            <StatCounter end={new Date().getFullYear() - stats.avgBaujahr} suffix=" Jahre" />
                        ) : (
                            <span className="loading-pulse">—</span>
                        )}
                    </div>
                    <div className="stat-card__label">Durchschnittsalter</div>
                </div>

                <div className="stat-card stat-card--money">
                    <div className="stat-card__value">
                        500 Mrd €
                    </div>
                    <div className="stat-card__label">
                        Infrastrukturpaket beschlossen
                    </div>
                    <div className="stat-card__bar">
                        <div
                            className="stat-card__bar-fill"
                            style={{ width: `${sondervermoegen_percent}%` }}
                        />
                    </div>
                    <div className="stat-card__sublabel">
                        Davon für Brücken freigegeben: {sondervermoegen_percent}%
                    </div>
                </div>
            </div>

            <div className="hero-dashboard__actions">
                <form onSubmit={handleSearch} className="hero-search">
                    <input
                        type="text"
                        value={plz}
                        onChange={(e) => setPlz(e.target.value)}
                        placeholder="Landkreis suchen..."
                        className="hero-search__input"
                    />
                    <button type="submit" className="hero-search__btn">
                        🔍 Suchen
                    </button>
                </form>
                <button
                    onClick={() => navigate('/rankings')}
                    className="hero-btn hero-btn--rankings"
                >
                    🏆 Schandmauer — Die schlimmsten Landkreise
                </button>
            </div>
        </div>
    );
}
