import { GradeLabel } from './GradeLabel';
import { ShareButtons } from './ShareButtons';
import type { LandkreisStats } from '../types';

interface LandkreisCardProps {
    stats: LandkreisStats;
}

export function LandkreisCard({ stats }: LandkreisCardProps) {
    const currentYear = new Date().getFullYear();
    const avgAge = Math.round(currentYear - stats.avg_baujahr);
    const base = window.location.pathname.replace(/\/$/, '');
    const shareUrl = `${window.location.origin}${base}/#/landkreis/${stats.slug}`;
    const shareText = `🚨 Infrastruktur-Zeugnis: ${stats.landkreis} — Note ${stats.avg_note.toFixed(1)} (${stats.kritisch_count} kritische Brücken von ${stats.total_bruecken})`;

    return (
        <div className="landkreis-card">
            <div className="landkreis-card__header">
                <div className="landkreis-card__icon">📋</div>
                <div className="landkreis-card__title-block">
                    <h2 className="landkreis-card__title">Infrastruktur-Zeugnis</h2>
                    <h3 className="landkreis-card__name">{stats.landkreis}</h3>
                    <span className="landkreis-card__bundesland">{stats.bundesland}</span>
                </div>
            </div>

            <div className="landkreis-card__grade-section">
                <GradeLabel note={stats.avg_note} size="xl" />
            </div>

            <div className="landkreis-card__stats">
                <div className="landkreis-card__stat">
                    <span className="landkreis-card__stat-value">{stats.total_bruecken}</span>
                    <span className="landkreis-card__stat-label">Brücken gesamt</span>
                </div>
                <div className="landkreis-card__stat landkreis-card__stat--critical">
                    <span className="landkreis-card__stat-value">{stats.kritisch_count}</span>
                    <span className="landkreis-card__stat-label">
                        Kritisch ({stats.kritisch_prozent}%)
                    </span>
                </div>
                <div className="landkreis-card__stat">
                    <span className="landkreis-card__stat-value">∅ {avgAge} J.</span>
                    <span className="landkreis-card__stat-label">Durchschnittsalter</span>
                </div>
                <div className="landkreis-card__stat">
                    <span className="landkreis-card__stat-value">{stats.schlechteste_note.toFixed(1)}</span>
                    <span className="landkreis-card__stat-label">Schlechteste Note</span>
                </div>
            </div>

            <div className="landkreis-card__bar">
                <div className="landkreis-card__bar-track">
                    <div
                        className="landkreis-card__bar-fill landkreis-card__bar-fill--ok"
                        style={{ width: `${100 - stats.kritisch_prozent}%` }}
                    />
                    <div
                        className="landkreis-card__bar-fill landkreis-card__bar-fill--critical"
                        style={{ width: `${stats.kritisch_prozent}%` }}
                    />
                </div>
                <div className="landkreis-card__bar-labels">
                    <span>OK</span>
                    <span>Kritisch</span>
                </div>
            </div>

            <div className="landkreis-card__share">
                <ShareButtons title="Infrastruktur-Zeugnis" text={shareText} url={shareUrl} />
            </div>
        </div>
    );
}
