export interface Bridge {
    bauwerksnummer: string;
    name: string;
    lat: number;
    lng: number;
    zustandsnote: number;
    zustandsklasse: string;
    baujahr: number;
    strasse: string;
    ort: string;
    landkreis: string;
    bundesland: string;
    baustoffklasse: string;
    traglastindex: number | null;
    stand: string;
    closure: boolean;
    area: number | null;
    construction: string | null;
    lastinspection: number | null;
    history: Record<string, number> | null;
}

export interface LandkreisStats {
    landkreis: string;
    bundesland: string;
    slug: string;
    total_bruecken: number;
    avg_note: number;
    kritisch_count: number;
    kritisch_prozent: number;
    avg_baujahr: number;
    beste_note: number;
    schlechteste_note: number;
}

export interface GradeInfo {
    label: string;
    color: string;
    bgColor: string;
    iconName: 'circle-check' | 'circle-alert' | 'circle-x';
}
