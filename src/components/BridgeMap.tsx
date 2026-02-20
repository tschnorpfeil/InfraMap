import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBridgesGeoJSON } from '../hooks/useData';
import { useDataContext } from '../contexts/DataProvider';
import { MAP_STYLE, GERMANY_CENTER, GERMANY_ZOOM, GERMANY_BOUNDS } from '../utils/constants';
import { getMapColor } from '../utils/grading';

interface BridgeMapProps {
    center?: [number, number];
    zoom?: number;
    className?: string;
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
};

export function BridgeMap({
    center = GERMANY_CENTER,
    zoom = GERMANY_ZOOM,
    className = '',
}: BridgeMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const layersAdded = useRef(false);
    const { selectedBridge, setSelectedBridge } = useDataContext();
    const { data: geojson, loading, progress } = useBridgesGeoJSON();
    const [mapReady, setMapReady] = useState(false);
    const pulseAnimation = useRef<number | null>(null);

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

        // Fit to Germany bounds — auto-calculates zoom for any screen size
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        map.fitBounds(GERMANY_BOUNDS, {
            padding: isTouch ? 0 : 20,
            animate: false,
        });
        // Only show +/- nav buttons on desktop
        if (!isTouch) {
            map.addControl(new maplibregl.NavigationControl(), 'top-right');
        }

        map.on('load', () => {
            // Switch all text labels to German
            for (const layer of map.getStyle().layers) {
                if (layer.type === 'symbol') {
                    const textField = map.getLayoutProperty(layer.id, 'text-field');
                    if (textField) {
                        map.setLayoutProperty(layer.id, 'text-field', [
                            'coalesce',
                            ['get', 'name:de'],
                            ['get', 'name_de'],
                            ['get', 'name'],
                        ]);
                    }
                }
            }
            setMapReady(true);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // ── Custom Event Listeners for Overlay Routing ──
    useEffect(() => {
        const handleFlyToBounds = (e: Event) => {
            const customEvent = e as CustomEvent<{ bounds: [[number, number], [number, number]]; padding?: number }>;
            if (mapRef.current && customEvent.detail?.bounds) {
                const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                mapRef.current.fitBounds(customEvent.detail.bounds, {
                    padding: customEvent.detail.padding ?? (isTouch ? 20 : 50),
                    duration: 1500, // Ms for smooth fly
                });
            }
        };

        const handleMapReset = () => {
            if (mapRef.current) {
                const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                mapRef.current.fitBounds(GERMANY_BOUNDS, {
                    padding: isTouch ? 0 : 20,
                    duration: 1500,
                });
            }
        };

        window.addEventListener('mapFlyToBounds', handleFlyToBounds);
        window.addEventListener('mapReset', handleMapReset);

        return () => {
            window.removeEventListener('mapFlyToBounds', handleFlyToBounds);
            window.removeEventListener('mapReset', handleMapReset);
        };
    }, [mapReady]);



    // Set up layers once when map is ready
    useEffect(() => {
        if (!mapRef.current || !mapReady || layersAdded.current) return;
        const m = mapRef.current;
        layersAdded.current = true;

        // Add source with empty data (will be updated progressively)
        m.addSource('bridges', {
            type: 'geojson',
            data: EMPTY_GEOJSON,
        });

        // ── Grade-segmented heatmaps ──
        // Each grade range gets its own heatmap layer in the correct note color.
        // Rendered bottom→top: green (good) → orange (warn) → red (critical).
        // Density within each layer = concentration of bridges in that grade range.

        // 1) Green glow — good bridges (Note < 2.0)
        m.addLayer({
            id: 'bridges-heat-good',
            type: 'heatmap',
            source: 'bridges',
            maxzoom: 10,
            filter: ['<', ['get', 'zustandsnote'], 2.0],
            paint: {
                'heatmap-weight': 0.5,
                'heatmap-intensity': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 0.25, 7, 0.7, 9, 1.0,
                ],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.2, 'rgba(34,197,94,0.12)',
                    0.5, 'rgba(34,197,94,0.25)',
                    0.8, 'rgba(74,222,128,0.35)',
                    1, 'rgba(74,222,128,0.45)',
                ],
                'heatmap-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 2, 7, 6, 9, 12,
                ],
                'heatmap-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    8, 0.7, 10, 0,
                ],
            },
        });

        // 2) Orange glow — moderate bridges (2.0 ≤ Note < 3.0)
        m.addLayer({
            id: 'bridges-heat-warn',
            type: 'heatmap',
            source: 'bridges',
            maxzoom: 10,
            filter: ['all',
                ['>=', ['get', 'zustandsnote'], 2.0],
                ['<', ['get', 'zustandsnote'], 3.0],
            ],
            paint: {
                'heatmap-weight': [
                    'interpolate', ['linear'],
                    ['get', 'zustandsnote'],
                    2.0, 0.5, 2.5, 0.7, 3.0, 1.0,
                ],
                'heatmap-intensity': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 0.35, 7, 0.85, 9, 1.3,
                ],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.15, 'rgba(234,179,8,0.12)',
                    0.35, 'rgba(249,115,22,0.25)',
                    0.6, 'rgba(249,115,22,0.40)',
                    0.85, 'rgba(249,115,22,0.50)',
                    1, 'rgba(234,88,12,0.60)',
                ],
                'heatmap-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 3, 7, 8, 9, 14,
                ],
                'heatmap-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    8, 0.8, 10, 0,
                ],
            },
        });

        // 3) Red glow — critical bridges (Note ≥ 3.0)
        m.addLayer({
            id: 'bridges-heat-crit',
            type: 'heatmap',
            source: 'bridges',
            maxzoom: 10,
            filter: ['>=', ['get', 'zustandsnote'], 3.0],
            paint: {
                'heatmap-weight': [
                    'interpolate', ['linear'],
                    ['get', 'zustandsnote'],
                    3.0, 0.5, 3.5, 0.8, 4.0, 1.0,
                ],
                'heatmap-intensity': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 0.5, 7, 1.1, 9, 1.8,
                ],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.1, 'rgba(239,68,68,0.18)',
                    0.3, 'rgba(239,68,68,0.35)',
                    0.55, 'rgba(220,38,38,0.50)',
                    0.8, 'rgba(183,28,28,0.65)',
                    1, 'rgba(153,27,27,0.80)',
                ],
                'heatmap-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 3, 7, 10, 9, 18,
                ],
                'heatmap-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    8, 0.9, 10, 0,
                ],
            },
        });

        // Circle layer — individual bridges, note-colored (zoom 7+)
        m.addLayer({
            id: 'bridges-circle',
            type: 'circle',
            source: 'bridges',
            minzoom: 7,
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 2, 10, 5, 14, 10,
                ],
                'circle-color': [
                    'interpolate', ['linear'],
                    ['get', 'zustandsnote'],
                    1.0, '#22c55e', 1.5, '#4ade80', 2.0, '#eab308',
                    2.5, '#f97316', 3.0, '#ef4444', 3.5, '#dc2626', 4.0, '#991b1b',
                ],
                'circle-stroke-color': '#000',
                'circle-stroke-width': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 0, 10, 0.8, 14, 1,
                ],
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 0, 9, 0.6, 10, 0.85,
                ],
            },
        });

        // ── Selected bridge highlight source + layers ──
        m.addSource('selected-bridge', {
            type: 'geojson',
            data: EMPTY_GEOJSON,
        });

        // Pulse ring (animated via JS)
        m.addLayer({
            id: 'selected-bridge-pulse',
            type: 'circle',
            source: 'selected-bridge',
            paint: {
                'circle-radius': 20,
                'circle-color': 'transparent',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-stroke-opacity': 0.6,
            },
        });

        // Glow ring (static, large, soft)
        m.addLayer({
            id: 'selected-bridge-glow',
            type: 'circle',
            source: 'selected-bridge',
            paint: {
                'circle-radius': 18,
                'circle-color': 'rgba(255, 255, 255, 0.08)',
                'circle-stroke-color': 'rgba(255, 255, 255, 0.3)',
                'circle-stroke-width': 2,
                'circle-blur': 0.4,
            },
        });

        // Bright dot center
        m.addLayer({
            id: 'selected-bridge-dot',
            type: 'circle',
            source: 'selected-bridge',
            paint: {
                'circle-radius': 8,
                'circle-color': '#ffffff',
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 2,
            },
        });

        // Click selection
        function handleClick(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
            const feature = e.features?.[0];
            if (!feature || feature.geometry.type !== 'Point') {
                setSelectedBridge(null);
                return;
            }

            const props = feature.properties as any;
            const lat = feature.geometry.coordinates[1] ?? 0;
            const lng = feature.geometry.coordinates[0] ?? 0;

            setSelectedBridge({
                bauwerksnummer: props?.id ?? '',
                name: props?.name ?? '',
                lat,
                lng,
                zustandsnote: props?.zustandsnote ?? 0,
                baujahr: props?.baujahr ?? 0,
                strasse: props?.strasse ?? '',
                landkreis: props?.landkreis ?? '',
                bundesland: props?.bundesland ?? '',
            });
        }

        function handleEnter() { m.getCanvas().style.cursor = 'pointer'; }
        function handleLeave() { m.getCanvas().style.cursor = ''; }

        m.on('click', 'bridges-circle', handleClick);
        m.on('mouseenter', 'bridges-circle', handleEnter);
        m.on('mouseleave', 'bridges-circle', handleLeave);

        // Dismiss selection when clicking empty map area
        function handleMapClick(e: maplibregl.MapMouseEvent) {
            const features = m.queryRenderedFeatures(e.point, { layers: ['bridges-circle'] });
            if (!features.length) {
                setSelectedBridge(null);
            }
        }
        m.on('click', handleMapClick);

        return () => {
            m.off('click', 'bridges-circle', handleClick);
            m.off('mouseenter', 'bridges-circle', handleEnter);
            m.off('mouseleave', 'bridges-circle', handleLeave);
            m.off('click', handleMapClick);
        };
    }, [mapReady]);

    // ── React to selectedBridge: update highlight source + flyTo ──
    useEffect(() => {
        const m = mapRef.current;
        if (!m || !mapReady) return;

        const source = m.getSource('selected-bridge');
        if (!source || !('setData' in source)) return;
        const geoSource = source as maplibregl.GeoJSONSource;

        // Cancel any existing pulse animation
        if (pulseAnimation.current) {
            cancelAnimationFrame(pulseAnimation.current);
            pulseAnimation.current = null;
        }

        if (!selectedBridge) {
            geoSource.setData(EMPTY_GEOJSON);
            return;
        }

        // Set the selected bridge feature
        geoSource.setData({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [selectedBridge.lng, selectedBridge.lat] },
                properties: {},
            }],
        });

        // Gentle flyTo — offset center upward so the bridge sits above the bottom sheet
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const currentZoom = m.getZoom();
        const targetZoom = Math.max(currentZoom, 12); // zoom in if needed

        m.flyTo({
            center: [selectedBridge.lng, selectedBridge.lat],
            zoom: targetZoom,
            offset: [0, isTouch ? -80 : -40], // shift point upward away from bottom sheet
            duration: 1200,
            essential: true,
        });

        // Animate pulse ring
        let start: number | null = null;
        const PULSE_DURATION = 1800; // ms per cycle

        function animatePulse(timestamp: number) {
            const map = mapRef.current;
            if (!map) return;
            if (!start) start = timestamp;
            const elapsed = (timestamp - start) % PULSE_DURATION;
            const t = elapsed / PULSE_DURATION; // 0→1

            // Expand radius from 12 → 35, fade opacity from 0.7 → 0
            const radius = 12 + t * 28;
            const opacity = 0.7 * (1 - t);

            if (map.getLayer('selected-bridge-pulse')) {
                map.setPaintProperty('selected-bridge-pulse', 'circle-radius', radius);
                map.setPaintProperty('selected-bridge-pulse', 'circle-stroke-opacity', opacity);
            }

            pulseAnimation.current = requestAnimationFrame(animatePulse);
        }

        pulseAnimation.current = requestAnimationFrame(animatePulse);

        return () => {
            if (pulseAnimation.current) {
                cancelAnimationFrame(pulseAnimation.current);
                pulseAnimation.current = null;
            }
        };
    }, [mapReady, selectedBridge]);

    // Hot-swap GeoJSON data progressively
    useEffect(() => {
        if (!mapRef.current || !mapReady || !geojson) return;
        const source = mapRef.current.getSource('bridges');
        if (source && 'setData' in source) {
            (source as maplibregl.GeoJSONSource).setData(geojson);
        }
    }, [mapReady, geojson]);

    return (
        <div className={`bridge-map-container ${className}`}>
            {loading && progress.loaded > 0 && (
                <div className="bridge-map__scan-text">
                    {progress.loaded < 5000
                        ? `🔴 ${progress.loaded.toLocaleString('de-DE')} kritische Brücken geladen…`
                        : progress.loaded < 20000
                            ? `🟡 ${progress.loaded.toLocaleString('de-DE')} / ~40.000 Brücken…`
                            : `🟢 ${progress.loaded.toLocaleString('de-DE')} / ~40.000 Brücken…`}
                </div>
            )}
            <div ref={mapContainer} className="bridge-map" />
        </div>
    );
}
