import { HeroDashboard } from '../components/HeroDashboard';
import { BridgeMap } from '../components/BridgeMap';

export function HomePage() {
    return (
        <div className="page page--home">
            <HeroDashboard />
            <div className="map-section">
                <BridgeMap className="home-map" />
            </div>
        </div>
    );
}
