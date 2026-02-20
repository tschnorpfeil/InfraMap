import type { GradeInfo } from '../types';

const GRADE_RANGES: { max: number; info: GradeInfo }[] = [
    { max: 1.5, info: { label: 'Sehr gut', color: '#22c55e', bgColor: '#052e16', iconName: 'circle-check' } },
    { max: 2.0, info: { label: 'Gut', color: '#4ade80', bgColor: '#052e16', iconName: 'circle-check' } },
    { max: 2.5, info: { label: 'Befriedigend', color: '#facc15', bgColor: '#422006', iconName: 'circle-alert' } },
    { max: 3.0, info: { label: 'Ausreichend', color: '#f97316', bgColor: '#431407', iconName: 'circle-alert' } },
    { max: 3.5, info: { label: 'Nicht ausreichend', color: '#ef4444', bgColor: '#450a0a', iconName: 'circle-x' } },
    { max: 4.1, info: { label: 'Ungenügend', color: '#dc2626', bgColor: '#450a0a', iconName: 'circle-x' } },
];

export function getGradeInfo(note: number): GradeInfo {
    for (const range of GRADE_RANGES) {
        if (note < range.max) {
            return range.info;
        }
    }
    return GRADE_RANGES[GRADE_RANGES.length - 1]!.info;
}

export function getGradeColor(note: number): string {
    return getGradeInfo(note).color;
}

export function getGradeLabel(note: number): string {
    return getGradeInfo(note).label;
}

export function getMapColor(note: number): string {
    if (note < 1.5) return '#22c55e';
    if (note < 2.0) return '#4ade80';
    if (note < 2.5) return '#eab308';
    if (note < 3.0) return '#f97316';
    if (note < 3.5) return '#ef4444';
    return '#dc2626';
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
