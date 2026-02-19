import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCounter } from './StatCounter';
import { useGlobalStats, useLandkreise } from '../hooks/useData';

export function HeroDashboard() {
    const stats = useGlobalStats();
    const { data: landkreise } = useLandkreise();
    const [search, setSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

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
                // If there's a search term but no suggestions visible, show them
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
                            {stats ? <StatCounter end={stats.totalBridges} /> : '—'}
                        </span>
                        <span className="hero-stat__label">Brücken</span>
                    </div>
                    <div className="hero-stat hero-stat--critical">
                        <span className="hero-stat__value">
                            {stats ? <StatCounter end={stats.criticalCount} /> : '—'}
                        </span>
                        <span className="hero-stat__label">
                            kritisch (Note ≥ 3,0)
                            {stats && <span className="hero-stat__pct"> · {stats.criticalPercent}%</span>}
                        </span>
                    </div>
                    <div className="hero-stat">
                        <span className="hero-stat__value">
                            ∅ {stats ? <StatCounter end={new Date().getFullYear() - stats.avgBaujahr} suffix=" J." /> : '—'}
                        </span>
                        <span className="hero-stat__label">Alter</span>
                    </div>
                </div>

                <div className="hero-overlay__search-wrapper" ref={dropdownRef}>
                    <div className="hero-overlay__search">
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => { if (search.trim().length >= 2) setShowDropdown(true); }}
                            placeholder="Landkreis suchen..."
                            className="hero-overlay__input"
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            className="hero-overlay__btn"
                            onClick={() => {
                                const first = suggestions[0];
                                if (first) selectLandkreis(first.slug);
                            }}
                        >
                            🔍
                        </button>
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
