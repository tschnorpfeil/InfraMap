export const APP_NAME = 'Brückenzeugnis';
export const APP_TITLE = 'Zustandsnoten für Deutschlands Brücken';
export const APP_DESCRIPTION =
    'Brückenzeugnis: Interaktive Karte zum Zustand aller 40.000 Brücken in Deutschland — datenbasiert, transparent, alarmierend.';

export const SONDERVERMOEGEN_TOTAL = 500_000_000_000;
export const SONDERVERMOEGEN_VERKEHR = 166_000_000_000;
export const SONDERVERMOEGEN_BRUECKEN_FREIGEGEBEN = 1_100_000_000;

export const GERMANY_CENTER: [number, number] = [10.4515, 51.1657];
export const GERMANY_ZOOM = 5.5;
export const GERMANY_BOUNDS: [[number, number], [number, number]] = [
    [5.4, 46.8],   // SW: wider than actual border
    [15.5, 55.5],   // NE: wider than actual border
];

export const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const CRITICAL_THRESHOLD = 3.0;
export const INSUFFICIENT_THRESHOLD = 2.5;

export const DAILY_TRAFFIC_ESTIMATE = 45_000_000;
