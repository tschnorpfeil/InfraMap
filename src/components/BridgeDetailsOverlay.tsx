import { useDataContext } from '../contexts/DataProvider';
import { GradeLabel } from './GradeLabel';

export function BridgeDetailsOverlay() {
    const { selectedBridge, setSelectedBridge } = useDataContext();

    if (!selectedBridge) return null;

    return (
        <div className="bridge-details-overlay">
            <div className="bridge-details-card">
                <button
                    className="bridge-details-close"
                    onClick={() => setSelectedBridge(null)}
                    aria-label="Schließen"
                >
                    ×
                </button>
                <div className="bridge-details-header">
                    <h3 className="bridge-details-name">{selectedBridge.name || 'Unbekannte Brücke'}</h3>
                    <div className="bridge-details-grade">
                        <GradeLabel note={selectedBridge.zustandsnote} size="lg" />
                    </div>
                </div>

                <div className="bridge-details-grid">
                    <div className="bridge-details-item">
                        <span className="bridge-details-label">Baujahr</span>
                        <span className="bridge-details-value">{selectedBridge.baujahr || 'Unbekannt'}</span>
                    </div>
                    <div className="bridge-details-item">
                        <span className="bridge-details-label">Straße</span>
                        <span className="bridge-details-value">{selectedBridge.strasse || '—'}</span>
                    </div>
                    <div className="bridge-details-item bridge-details-item--full">
                        <span className="bridge-details-label">Landkreis</span>
                        <span className="bridge-details-value">{selectedBridge.landkreis || '—'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
