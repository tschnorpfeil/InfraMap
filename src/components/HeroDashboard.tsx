import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCounter } from './StatCounter';
import { useGlobalStats, useLandkreise } from '../hooks/useData';
import { useDataContext } from '../contexts/DataProvider';

export function HeroDashboard() {
    const stats = useGlobalStats();
    const { data: landkreise } = useLandkreise();
    const { selectedBridge } = useDataContext();
    const [search, setSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    const avgAge = stats ? new Date().getFullYear() - stats.avgBaujahr : 0;

    // Filter Landkreise by search term
    const suggestions = useMemo(() => {
        if (!landkreise || search.trim().length < 2) return [];
        const q = search.trim().toLowerCase();
        return landkreise
            .filter((lk) => lk.landkreis.toLowerCase().includes(q))
            .slice(0, 6);
    }, [landkreise, search]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function selectLandkreis(slug: string) {
        setShowDropdown(false);
        setSearch('');
        navigate(`/landkreis/${slug}`);
    }

    function handleInputChange(value: string) {
        setSearch(value);
        setSelectedIdx(-1);
        setShowDropdown(value.trim().length >= 2);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (!showDropdown || suggestions.length === 0) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (search.trim().length >= 2) setShowDropdown(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIdx((prev) => Math.max(prev - 1, -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIdx >= 0 && suggestions[selectedIdx]) {
                    selectLandkreis(suggestions[selectedIdx].slug);
                } else if (suggestions.length > 0 && suggestions[0]) {
                    selectLandkreis(suggestions[0].slug);
                }
                break;
            case 'Escape':
                setShowDropdown(false);
                break;
        }
    }

    return (
        <div className={`hero-overlay${selectedBridge ? ' hero-overlay--hidden' : ''}`}>
            <div className="hero-overlay__card">
                {/* ── Header ── */}
                <div className="hero-overlay__header">
                    <h1 className="hero-overlay__title">Brückenzeugnis</h1>
                </div>
                <p className="hero-overlay__datenstand">
                    Quelle: BASt · Stand September 2025
                </p>

                {/* ── KPI Grid: 2×2 ── */}
                <div className="hero-kpi-grid">
                    <div className="hero-kpi">
                        <span className="hero-kpi__value">
                            {stats ? <StatCounter end={stats.totalBridges} /> : '—'}
                        </span>
                        <span className="hero-kpi__label">Brücken erfasst</span>
                    </div>

                    <div className="hero-kpi hero-kpi--accent">
                        <span className="hero-kpi__value">
                            {stats ? <StatCounter end={stats.avgNote} decimals={1} /> : '—'}
                        </span>
                        <span className="hero-kpi__label">∅ Zustandsnote</span>
                    </div>

                    <div className="hero-kpi hero-kpi--alarm">
                        <span className="hero-kpi__value">
                            {stats ? <StatCounter end={stats.criticalCount} /> : '—'}
                        </span>
                        <span className="hero-kpi__label">
                            kritisch <span className="hero-kpi__note-hint">Note ≥ 3,0</span>
                        </span>
                    </div>

                    <div className="hero-kpi">
                        <span className="hero-kpi__value">
                            {stats ? <StatCounter end={avgAge} suffix=" J." /> : '—'}
                        </span>
                        <span className="hero-kpi__label">∅ Alter</span>
                    </div>
                </div>

                {/* ── Search ── */}
                <div className="hero-overlay__search-wrapper" ref={dropdownRef}>
                    <div className="hero-overlay__search">
                        <svg className="hero-overlay__search-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => { if (search.trim().length >= 2) setShowDropdown(true); }}
                            placeholder="Landkreis suchen…"
                            className="hero-overlay__input"
                            autoComplete="off"
                        />
                    </div>

                    {showDropdown && suggestions.length > 0 && (
                        <div className="hero-autocomplete">
                            {suggestions.map((lk, i) => (
                                <button
                                    key={lk.slug}
                                    className={`hero-autocomplete__item ${i === selectedIdx ? 'hero-autocomplete__item--active' : ''}`}
                                    onClick={() => selectLandkreis(lk.slug)}
                                    onMouseEnter={() => setSelectedIdx(i)}
                                >
                                    <span className="hero-autocomplete__name">{lk.landkreis}</span>
                                    <span className="hero-autocomplete__meta">
                                        Note {lk.avg_note.toFixed(1)} · {lk.total_bruecken} Brücken
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
