import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useBridgesGeoJSON } from '../hooks/useData';
import { MAP_STYLE, GERMANY_CENTER, GERMANY_ZOOM } from '../utils/constants';
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
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const layersAdded = useRef(false);
    const { data: geojson, loading, progress } = useBridgesGeoJSON();
    const [mapReady, setMapReady] = useState(false);

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
            setMapReady(true);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);



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

        // Heatmap layer
        m.addLayer({
            id: 'bridges-heat',
            type: 'heatmap',
            source: 'bridges',
            maxzoom: 9,
            paint: {
                'heatmap-weight': [
                    'interpolate', ['linear'],
                    ['get', 'zustandsnote'],
                    1.0, 0.05, 2.0, 0.2, 2.5, 0.5, 3.0, 0.85, 4.0, 1,
                ],
                'heatmap-intensity': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 0.35, 6, 0.7, 9, 1.4,
                ],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.1, 'rgba(34,197,94,0.3)',
                    0.25, 'rgba(234,179,8,0.5)',
                    0.45, 'rgba(249,115,22,0.6)',
                    0.65, 'rgba(239,68,68,0.7)',
                    1, 'rgba(220,38,38,0.85)',
                ],
                'heatmap-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    4, 2, 6, 6, 8, 14, 9, 20,
                ],
                'heatmap-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 0.9, 9, 0,
                ],
            },
        });

        // Circle layer
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
                'circle-stroke-width': 1,
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 0, 8, 0.8,
                ],
            },
        });

        // Click popup
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
    }, [mapReady]);

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
