import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GradeLabel } from './GradeLabel';
import { useLandkreise } from '../hooks/useData';
import { slugify } from '../utils/grading';

type SortKey = 'avg_note' | 'total_bruecken' | 'kritisch_prozent' | 'avg_baujahr';

export function RankingsTable() {
    const { data: landkreise, loading, error } = useLandkreise();
    const [sortBy, setSortBy] = useState<SortKey>('avg_note');
    const [sortDesc, setSortDesc] = useState(true);
    const [filterBundesland, setFilterBundesland] = useState('');
    const navigate = useNavigate();

    if (loading) return <div className="loading-message">Lade Rankings...</div>;
    if (error) return <div className="error-message">Fehler: {error}</div>;
    if (!landkreise) return null;

    const bundeslaender = [...new Set(landkreise.map((lk) => lk.bundesland))].sort();

    const filtered = filterBundesland
        ? landkreise.filter((lk) => lk.bundesland === filterBundesland)
        : landkreise;

    const sorted = [...filtered].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        if (aVal === bVal) return 0;
        return sortDesc ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });

    function handleSort(key: SortKey) {
        if (sortBy === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortBy(key);
            setSortDesc(true);
        }
    }

    function sortIndicator(key: SortKey) {
        if (sortBy !== key) return '';
        return sortDesc ? ' ↓' : ' ↑';
    }

    return (
        <div className="rankings">
            <div className="rankings__filters">
                <select
                    value={filterBundesland}
                    onChange={(e) => setFilterBundesland(e.target.value)}
                    className="rankings__select"
                >
                    <option value="">Alle Bundesländer</option>
                    {bundeslaender.map((bl) => (
                        <option key={bl} value={bl}>{bl}</option>
                    ))}
                </select>
                <span className="rankings__count">{sorted.length} Landkreise</span>
            </div>

            <div className="rankings__table-wrapper">
                <table className="rankings__table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Landkreis</th>
                            <th>Bundesland</th>
                            <th className="sortable" onClick={() => handleSort('avg_note')}>
                                Note{sortIndicator('avg_note')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('total_bruecken')}>
                                Brücken{sortIndicator('total_bruecken')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('kritisch_prozent')}>
                                Kritisch %{sortIndicator('kritisch_prozent')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('avg_baujahr')}>
                                ∅ Baujahr{sortIndicator('avg_baujahr')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((lk, i) => (
                            <tr
                                key={lk.landkreis}
                                className="rankings__row"
                                onClick={() => navigate(`/landkreis/${slugify(lk.landkreis)}`)}
                            >
                                <td className="rankings__rank">{i + 1}</td>
                                <td className="rankings__name">{lk.landkreis}</td>
                                <td className="rankings__bl">{lk.bundesland}</td>
                                <td>
                                    <GradeLabel note={lk.avg_note} size="sm" showLabel={false} />
                                </td>
                                <td>{lk.total_bruecken}</td>
                                <td className={lk.kritisch_prozent > 20 ? 'text-alarm' : ''}>
                                    {lk.kritisch_prozent}%
                                </td>
                                <td>{Math.round(lk.avg_baujahr)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
