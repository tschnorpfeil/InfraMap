import { HeroDashboard } from '../components/HeroDashboard';
import { BridgeMap } from '../components/BridgeMap';

export function HomePage() {
    return (
        <div className="page page--home">
            <div className="map-hero">
                <BridgeMap className="home-map" />
                <HeroDashboard />
            </div>
        </div>
    );
}
