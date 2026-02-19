import { useParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { LandkreisCard } from '../components/LandkreisCard';
import { GradeLabel } from '../components/GradeLabel';
import { BridgeMap } from '../components/BridgeMap';
import { useLandkreise, useBridges } from '../hooks/useData';
import { slugify } from '../utils/grading';

export function LandkreisPage() {
    const { slug } = useParams<{ slug: string }>();
    const { data: landkreise, loading: lkLoading } = useLandkreise();

    const match = landkreise?.find((lk) => slugify(lk.landkreis) === slug) ?? null;

    const { data: bridges, loading: brLoading } = useBridges(
        match ? { landkreis: match.landkreis } : undefined
    );

    useEffect(() => {
        if (match) {
            document.title = `${match.landkreis} — Brückenzeugnis`;
        }
    }, [match]);

    // Fly to bounds when bridges load
    useEffect(() => {
        if (bridges && bridges.length > 0) {
            let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
            for (const b of bridges) {
                if (b.lng < minLng) minLng = b.lng;
                if (b.lng > maxLng) maxLng = b.lng;
                if (b.lat < minLat) minLat = b.lat;
                if (b.lat > maxLat) maxLat = b.lat;
            }
            if (minLng !== Infinity) {
                window.dispatchEvent(new CustomEvent('mapFlyToBounds', {
                    detail: { bounds: [[minLng, minLat], [maxLng, maxLat]] }
                }));
            }
        }
    }, [bridges]);

    // Reset map when leaving Landkreis
    useEffect(() => {
        return () => {
            window.dispatchEvent(new CustomEvent('mapReset'));
        };
    }, []);

    if (lkLoading) {
        return (
            <div className="page page--loading">
                <div className="loading-spinner" />
                Lade Landkreis...
            </div>
        );
    }

    if (!match) {
        return (
            <div className="page page--not-found">
                <h1>Landkreis nicht gefunden</h1>
                <p>Der Landkreis „{slug}" wurde nicht in der Datenbank gefunden.</p>
                <Link to="/" className="back-link">← Zurück zur Karte</Link>
            </div>
        );
    }

    return (
        <div className="page page--landkreis page--overlay overlay-sidebar">
            <div className="landkreis-page__nav">
                <Link to="/" className="back-link">← Karte</Link>
                <Link to="/rankings" className="back-link">🏆 Rankings</Link>
            </div>

            <div className="landkreis-page__content">
                <div className="landkreis-page__card">
                    <LandkreisCard stats={match} />
                </div>

                <div className="landkreis-page__bridges">
                    <h3 className="section-title">
                        Brücken in {match.landkreis}
                        {bridges && <span className="section-count">({bridges.length})</span>}
                    </h3>

                    {brLoading ? (
                        <div className="loading-message">Lade Brücken...</div>
                    ) : (
                        <div className="bridge-list">
                            {bridges?.map((b) => (
                                <div key={b.bauwerksnummer} className="bridge-item">
                                    <div className="bridge-item__main">
                                        <span className="bridge-item__name">{b.name}</span>
                                        <GradeLabel note={b.zustandsnote} size="sm" showLabel={false} />
                                    </div>
                                    <div className="bridge-item__details">
                                        <span>{b.strasse}</span>
                                        <span>Baujahr {b.baujahr}</span>
                                        <span>{b.baustoffklasse}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
