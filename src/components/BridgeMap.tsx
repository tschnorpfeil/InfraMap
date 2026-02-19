import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBridgesGeoJSON } from '../hooks/useData';
import { MAP_STYLE, GERMANY_CENTER, GERMANY_ZOOM } from '../utils/constants';
import { getMapColor } from '../utils/grading';

// Simplified Germany border polygon (~30 points, WGS84)
const GERMANY_POLYGON: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
        type: 'Polygon',
        coordinates: [[
            [8.6, 54.9], [9.9, 54.5], [10.8, 54.0], [11.4, 54.3], [12.5, 54.4],
            [13.4, 54.3], [14.2, 53.9], [14.4, 53.3], [14.7, 52.1], [14.7, 51.5],
            [15.0, 51.0], [14.3, 50.9], [12.9, 50.3], [12.1, 50.3], [12.1, 49.5],
            [13.0, 48.9], [13.4, 48.6], [13.0, 47.5], [12.2, 47.6], [10.5, 47.3],
            [9.6, 47.5], [8.6, 47.7], [7.6, 47.6], [7.5, 48.1], [7.7, 48.5],
            [7.8, 49.0], [6.8, 49.2], [6.3, 49.8], [6.1, 50.1], [6.0, 50.8],
            [5.9, 51.0], [6.0, 51.8], [6.7, 51.9], [7.0, 52.2], [7.2, 53.3],
            [6.9, 53.6], [7.9, 53.8], [8.6, 53.9], [8.9, 54.0], [8.6, 54.9],
        ]],
    },
};

interface BridgeMapProps {
    center?: [number, number];
    zoom?: number;
    className?: string;
}

export function BridgeMap({
    center = GERMANY_CENTER,
    zoom = GERMANY_ZOOM,
    className = '',
}: BridgeMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const scanAnimRef = useRef<number | null>(null);
    const { data: geojson, loading } = useBridgesGeoJSON();
    const [mapReady, setMapReady] = useState(false);

    // Animate the scan pulse on the Germany polygon
    const startScanAnimation = useCallback((map: maplibregl.Map) => {
        const startTime = Date.now();
        const CYCLE_MS = 2800;

        function animate() {
            if (!map.getLayer('germany-scan-fill')) return;

            const elapsed = (Date.now() - startTime) % CYCLE_MS;
            const t = elapsed / CYCLE_MS;

            // Pulsing fill opacity: 0.05 → 0.2 → 0.05
            const fillOpacity = 0.05 + 0.15 * Math.sin(t * Math.PI * 2);

            // Border glow: 0.3 → 0.8 → 0.3
            const lineOpacity = 0.3 + 0.5 * Math.sin(t * Math.PI * 2);

            try {
                map.setPaintProperty('germany-scan-fill', 'fill-opacity', fillOpacity);
                map.setPaintProperty('germany-scan-line', 'line-opacity', lineOpacity);
                map.setPaintProperty('germany-scan-line', 'line-width', 1.5 + Math.sin(t * Math.PI * 2));
            } catch {
                // Layer might have been removed
                return;
            }

            scanAnimRef.current = requestAnimationFrame(animate);
        }

        scanAnimRef.current = requestAnimationFrame(animate);
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: MAP_STYLE,
            center,
            zoom,
            minZoom: 4,
            maxZoom: 16,
            attributionControl: {},
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
            // Add Germany scan polygon immediately on map load
            map.addSource('germany-border', {
                type: 'geojson',
                data: GERMANY_POLYGON,
            });

            map.addLayer({
                id: 'germany-scan-fill',
                type: 'fill',
                source: 'germany-border',
                paint: {
                    'fill-color': '#ff2d2d',
                    'fill-opacity': 0.08,
                },
            });

            map.addLayer({
                id: 'germany-scan-line',
                type: 'line',
                source: 'germany-border',
                paint: {
                    'line-color': '#ff2d2d',
                    'line-width': 2,
                    'line-opacity': 0.5,
                },
            });

            startScanAnimation(map);
            setMapReady(true);
        });

        mapRef.current = map;

        return () => {
            if (scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current);
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Remove scan layers when data loads, add bridge layers
    useEffect(() => {
        if (!mapRef.current || !mapReady || !geojson) return;
        const m = mapRef.current;

        // Stop scan animation and remove scan layers
        if (scanAnimRef.current) {
            cancelAnimationFrame(scanAnimRef.current);
            scanAnimRef.current = null;
        }
        if (m.getLayer('germany-scan-fill')) m.removeLayer('germany-scan-fill');
        if (m.getLayer('germany-scan-line')) m.removeLayer('germany-scan-line');
        if (m.getSource('germany-border')) m.removeSource('germany-border');

        // Remove existing bridge layers if updating
        if (m.getLayer('bridges-circle')) m.removeLayer('bridges-circle');
        if (m.getLayer('bridges-heat')) m.removeLayer('bridges-heat');
        if (m.getSource('bridges')) m.removeSource('bridges');

        m.addSource('bridges', {
            type: 'geojson',
            data: geojson,
        });

        // Heatmap layer — balanced for 40k points
        m.addLayer({
            id: 'bridges-heat',
            type: 'heatmap',
            source: 'bridges',
            maxzoom: 9,
            paint: {
                'heatmap-weight': [
                    'interpolate', ['linear'],
                    ['get', 'zustandsnote'],
                    1.0, 0.05,
                    2.0, 0.15,
                    2.5, 0.4,
                    3.0, 0.8,
                    4.0, 1,
                ],
                'heatmap-intensity': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 0.3,
                    6, 0.6,
                    9, 1.2,
                ],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.1, 'rgba(34,197,94,0.25)',
                    0.25, 'rgba(234,179,8,0.45)',
                    0.45, 'rgba(249,115,22,0.55)',
                    0.65, 'rgba(239,68,68,0.65)',
                    1, 'rgba(220,38,38,0.8)',
                ],
                'heatmap-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 2,
                    6, 5,
                    8, 12,
                    9, 18,
                ],
                'heatmap-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 0.9,
                    9, 0,
                ],
            },
        });

        // Circle layer (visible at higher zoom)
        m.addLayer({
            id: 'bridges-circle',
            type: 'circle',
            source: 'bridges',
            minzoom: 7,
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 2,
                    10, 5,
                    14, 10,
                ],
                'circle-color': [
                    'interpolate', ['linear'],
                    ['get', 'zustandsnote'],
                    1.0, '#22c55e',
                    1.5, '#4ade80',
                    2.0, '#eab308',
                    2.5, '#f97316',
                    3.0, '#ef4444',
                    3.5, '#dc2626',
                    4.0, '#991b1b',
                ],
                'circle-stroke-color': '#000',
                'circle-stroke-width': 1,
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 0,
                    8, 0.8,
                ],
            },
        });

        // Click popup handler
        function handleClick(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
            const feature = e.features?.[0];
            if (!feature || feature.geometry.type !== 'Point') return;

            const coords = feature.geometry.coordinates.slice() as [number, number];
            const props = feature.properties;
            const note = props?.zustandsnote ?? 0;
            const noteColor = getMapColor(note);

            if (popupRef.current) popupRef.current.remove();

            popupRef.current = new maplibregl.Popup({ maxWidth: '320px' })
                .setLngLat(coords)
                .setHTML(`
          <div class="bridge-popup">
            <h3 class="bridge-popup__name">${props?.name ?? 'Unbekannt'}</h3>
            <div class="bridge-popup__note" style="color: ${noteColor}">
              Note: ${Number(note).toFixed(1)}
            </div>
            <div class="bridge-popup__details">
              <span>Baujahr: ${props?.baujahr ?? '?'}</span>
              <span>Straße: ${props?.strasse ?? '?'}</span>
              <span>Landkreis: ${props?.landkreis ?? '?'}</span>
            </div>
          </div>
        `)
                .addTo(m);
        }

        function handleEnter() { m.getCanvas().style.cursor = 'pointer'; }
        function handleLeave() { m.getCanvas().style.cursor = ''; }

        m.on('click', 'bridges-circle', handleClick);
        m.on('mouseenter', 'bridges-circle', handleEnter);
        m.on('mouseleave', 'bridges-circle', handleLeave);

        return () => {
            m.off('click', 'bridges-circle', handleClick);
            m.off('mouseenter', 'bridges-circle', handleEnter);
            m.off('mouseleave', 'bridges-circle', handleLeave);
        };
    }, [mapReady, geojson]);

    return (
        <div className={`bridge-map-container ${className}`}>
            {loading && (
                <div className="bridge-map__scan-text">
                    <span className="bridge-map__scan-icon">📡</span>
                    <span>Scanne ~40.000 Brücken…</span>
                </div>
            )}
            <div ref={mapContainer} className="bridge-map" />
        </div>
    );
}
