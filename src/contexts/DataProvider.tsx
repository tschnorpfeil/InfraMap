import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { LandkreisStats } from '../types';
import { slugify } from '../utils/grading';

// ── Types ──

interface MinimalBridge {
    bauwerksnummer: string;
    name: string;
    lat: number;
    lng: number;
    zustandsnote: number;
    baujahr: number;
    strasse: string;
    landkreis: string;
    bundesland: string;
}

interface GlobalStats {
    totalBridges: number;
    criticalCount: number;
    criticalPercent: number;
    avgBaujahr: number;
    avgNote: number;
}

interface BridgeLoadProgress {
    loaded: number;
    estimatedTotal: number;
    done: boolean;
}

interface DataContextValue {
    // GeoJSON — updates progressively as pages load
    geojson: GeoJSON.FeatureCollection | null;
    bridgeProgress: BridgeLoadProgress;

    // Landkreise — cached after first load
    landkreise: LandkreisStats[] | null;
    landkreiseLoading: boolean;

    // Global stats — cached after first load
    globalStats: GlobalStats | null;
}

const DataContext = createContext<DataContextValue | null>(null);

// ── Helper: convert bridge rows to GeoJSON features ──

function bridgesToFeatures(bridges: MinimalBridge[]): GeoJSON.Feature[] {
    return bridges
        .filter((b) => b.lat != null && b.lng != null)
        .map((b) => ({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [b.lng, b.lat],
            },
            properties: {
                id: b.bauwerksnummer,
                name: b.name,
                zustandsnote: b.zustandsnote,
                baujahr: b.baujahr,
                strasse: b.strasse,
                landkreis: b.landkreis,
                bundesland: b.bundesland,
            },
        }));
}

// ── Helper: merge fragmented Landkreis stats ──

function mergeLandkreisStats(allStats: Record<string, unknown>[]): LandkreisStats[] {
    const merged = new Map<string, LandkreisStats>();

    for (const raw of allStats) {
        const name = String(raw['landkreis'] ?? '').trim();
        if (!name) continue;
        const slug = slugify(name);

        const existing = merged.get(slug);
        const total = Number(raw['total_bruecken'] ?? 0);
        const kritisch = Number(raw['kritisch_count'] ?? 0);
        const avgNote = Number(raw['avg_note'] ?? 0);
        const avgBaujahr = Number(raw['avg_baujahr'] ?? 0);
        const besteNote = Number(raw['beste_note'] ?? 4);
        const schlechtesteNote = Number(raw['schlechteste_note'] ?? 0);

        if (existing) {
            const newTotal = existing.total_bruecken + total;
            existing.avg_note =
                (existing.avg_note * existing.total_bruecken + avgNote * total) / newTotal;
            existing.avg_baujahr =
                (existing.avg_baujahr * existing.total_bruecken + avgBaujahr * total) / newTotal;
            existing.total_bruecken = newTotal;
            existing.kritisch_count += kritisch;
            existing.kritisch_prozent =
                newTotal > 0 ? Math.round((existing.kritisch_count / newTotal) * 1000) / 10 : 0;
            existing.beste_note = Math.min(existing.beste_note, besteNote);
            existing.schlechteste_note = Math.max(existing.schlechteste_note, schlechtesteNote);
            if (name.length < existing.landkreis.length) {
                existing.landkreis = name;
            }
        } else {
            merged.set(slug, {
                landkreis: name,
                bundesland: String(raw['bundesland'] ?? ''),
                slug,
                total_bruecken: total,
                avg_note: avgNote,
                kritisch_count: kritisch,
                kritisch_prozent: total > 0 ? Math.round((kritisch / total) * 1000) / 10 : 0,
                avg_baujahr: avgBaujahr,
                beste_note: besteNote,
                schlechteste_note: schlechtesteNote,
            });
        }
    }

    return Array.from(merged.values()).sort((a, b) => b.avg_note - a.avg_note);
}

// ── Provider ──

const PAGE_SIZE = 1000;
const ESTIMATED_TOTAL = 40000;
const BRIDGE_SELECT = 'bauwerksnummer, name, lat, lng, zustandsnote, baujahr, strasse, landkreis, bundesland';

export function DataProvider({ children }: { children: ReactNode }) {
    // Bridge GeoJSON (progressive)
    const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
    const [bridgeProgress, setBridgeProgress] = useState<BridgeLoadProgress>({
        loaded: 0, estimatedTotal: ESTIMATED_TOTAL, done: false,
    });

    // Landkreise (cached)
    const [landkreise, setLandkreise] = useState<LandkreisStats[] | null>(null);
    const [landkreiseLoading, setLandkreiseLoading] = useState(true);

    // Global stats (cached)
    const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);

    // ── Progressive bridge loading (worst grades first) ──
    useEffect(() => {
        let cancelled = false;
        const allFeatures: GeoJSON.Feature[] = [];

        async function streamBridges() {
            let from = 0;
            let hasMore = true;

            while (hasMore && !cancelled) {
                const { data, error } = await supabase
                    .from('bruecken')
                    .select(BRIDGE_SELECT)
                    .order('zustandsnote', { ascending: false })
                    .range(from, from + PAGE_SIZE - 1);

                if (error) throw new Error(error.message);
                const rows = (data ?? []) as MinimalBridge[];
                const newFeatures = bridgesToFeatures(rows);
                allFeatures.push(...newFeatures);

                if (!cancelled) {
                    // New object reference triggers React update, but reuse same features array
                    setGeojson({
                        type: 'FeatureCollection',
                        features: allFeatures,
                    });
                    setBridgeProgress({
                        loaded: allFeatures.length,
                        estimatedTotal: ESTIMATED_TOTAL,
                        done: rows.length < PAGE_SIZE,
                    });
                }

                hasMore = rows.length === PAGE_SIZE;
                from += PAGE_SIZE;
            }

            if (!cancelled) {
                setBridgeProgress((prev) => ({ ...prev, done: true }));
            }
        }

        streamBridges().catch((err) => {
            if (!cancelled) console.error('Bridge loading failed:', err);
        });

        return () => { cancelled = true; };
    }, []);

    // ── Landkreise (one-shot) ──
    useEffect(() => {
        let cancelled = false;

        async function fetchLandkreise() {
            const allRows: Record<string, unknown>[] = [];
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('landkreis_stats')
                    .select('*')
                    .range(from, from + PAGE_SIZE - 1);

                if (error) throw new Error(error.message);
                const rows = (data ?? []) as Record<string, unknown>[];
                allRows.push(...rows);
                hasMore = rows.length === PAGE_SIZE;
                from += PAGE_SIZE;
            }

            if (!cancelled) {
                setLandkreise(mergeLandkreisStats(allRows));
                setLandkreiseLoading(false);
            }
        }

        fetchLandkreise().catch((err) => {
            if (!cancelled) {
                console.error('Landkreise loading failed:', err);
                setLandkreiseLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, []);

    // ── Global stats (one-shot) ──
    useEffect(() => {

        async function fetchStats() {
            const { count: totalBridges } = await supabase
                .from('bruecken')
                .select('*', { count: 'exact', head: true });

            const { count: criticalCount } = await supabase
                .from('bruecken')
                .select('*', { count: 'exact', head: true })
                .gte('zustandsnote', 3.0);

            const { data: avgData } = await supabase.rpc('global_bridge_stats');

            const total = totalBridges ?? 0;
            const critical = criticalCount ?? 0;

            setGlobalStats({
                totalBridges: total,
                criticalCount: critical,
                criticalPercent: total > 0 ? Math.round((critical / total) * 1000) / 10 : 0,
                avgBaujahr: avgData?.[0]?.avg_baujahr ?? 0,
                avgNote: avgData?.[0]?.avg_note ?? 0,
            });
        }

        fetchStats().catch(console.error);
    }, []);

    const value: DataContextValue = {
        geojson,
        bridgeProgress,
        landkreise,
        landkreiseLoading,
        globalStats,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ── Hook to consume context ──

export function useDataContext(): DataContextValue {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useDataContext must be used within DataProvider');
    return ctx;
}
