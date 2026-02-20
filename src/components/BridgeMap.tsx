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

        // Measure actual UI chrome to compute map padding dynamically
        function getMapPadding(): maplibregl.PaddingOptions | number {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) return 20;
            const header = document.querySelector('.app-header');
            const kpiStrip = document.querySelector('.hero-overlay');
            const topPad = header ? header.getBoundingClientRect().height + 8 : 60;
            const bottomPad = kpiStrip ? kpiStrip.getBoundingClientRect().height + 8 : 200;
            return { top: topPad, bottom: bottomPad, left: 10, right: 10 };
        }

        // Fit to Germany bounds — auto-calculates zoom for any screen size
        map.fitBounds(GERMANY_BOUNDS, {
            padding: getMapPadding(),
            animate: false,
        });
        // Only show +/- nav buttons on desktop
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
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
                const isMobile = window.innerWidth <= 768;
                let padding: maplibregl.PaddingOptions | number = 20;
                if (isMobile) {
                    const header = document.querySelector('.app-header');
                    const kpiStrip = document.querySelector('.hero-overlay');
                    const topPad = header ? header.getBoundingClientRect().height + 8 : 60;
                    const bottomPad = kpiStrip ? kpiStrip.getBoundingClientRect().height + 8 : 200;
                    padding = { top: topPad, bottom: bottomPad, left: 10, right: 10 };
                }
                mapRef.current.fitBounds(GERMANY_BOUNDS, {
                    padding,
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
                    'case',
                    ['==', ['get', 'closure'], true], '#000000',
                    [
                        'interpolate', ['linear'],
                        ['get', 'zustandsnote'],
                        1.0, '#22c55e', 1.5, '#4ade80', 2.0, '#eab308',
                        2.5, '#f97316', 3.0, '#ef4444', 3.5, '#dc2626', 4.0, '#991b1b',
                    ]
                ],
                'circle-stroke-color': [
                    'case',
                    ['==', ['get', 'closure'], true], '#ff2d2d',
                    '#000'
                ],
                'circle-stroke-width': [
                    'interpolate', ['linear'], ['zoom'],
                    7, [
                        'case',
                        ['==', ['get', 'closure'], true], 2,
                        0
                    ],
                    10, [
                        'case',
                        ['==', ['get', 'closure'], true], 2,
                        0.8
                    ],
                    14, [
                        'case',
                        ['==', ['get', 'closure'], true], 2,
                        1
                    ]
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
                closure: props?.closure ?? false,
                area: props?.area ?? null,
                construction: props?.construction ?? null,
                lastinspection: props?.lastinspection ?? null,
                history: typeof props?.history === 'string' ? JSON.parse(props.history) : (props?.history ?? null),
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
        const isMobile = window.innerWidth <= 768;
        const currentZoom = m.getZoom();
        const targetZoom = Math.max(currentZoom, 13); // zoom in a bit more for details

        // Calculate dynamic offset based on the details overlay height
        let yOffset = -40; // Default desktop offset
        if (isMobile) {
            const overlay = document.querySelector('.bridge-details-overlay');
            if (overlay) {
                const overlayHeight = overlay.getBoundingClientRect().height;
                // Shift up by half the overlay height so it centers in the remaining visible space
                yOffset = -(overlayHeight / 2) - 20;
            } else {
                yOffset = -150; // Fallback if overlay isn't rendered yet
            }
        }

        m.flyTo({
            center: [selectedBridge.lng, selectedBridge.lat],
            zoom: targetZoom,
            offset: [0, yOffset], // shift point upward away from bottom sheet
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
            <div ref={mapContainer} className="bridge-map" />
        </div>
    );
}
