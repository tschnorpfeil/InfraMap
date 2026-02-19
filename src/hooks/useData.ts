import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Bridge, LandkreisStats } from '../types';
import { slugify } from '../utils/grading';

interface DataState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

// Helper: paginate through ALL rows (Supabase defaults to 1000)
async function fetchAllRows<T>(
    table: string,
    select: string,
): Promise<T[]> {
    const PAGE_SIZE = 1000;
    const allRows: T[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(table)
            .select(select)
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw new Error(error.message);
        const rows = (data ?? []) as T[];
        allRows.push(...rows);
        hasMore = rows.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }

    return allRows;
}

export function useBridges(filters?: {
    landkreis?: string;
    bundesland?: string;
    minNote?: number;
    limit?: number;
}) {
    const [state, setState] = useState<DataState<Bridge[]>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        async function fetchBridges() {
            setState((prev) => ({ ...prev, loading: true, error: null }));

            try {
                const select =
                    'bauwerksnummer, name, lat, lng, zustandsnote, zustandsklasse, baujahr, strasse, ort, landkreis, bundesland, baustoffklasse, traglastindex, stand';

                let query = supabase
                    .from('bruecken')
                    .select(select)
                    .order('zustandsnote', { ascending: false });

                if (filters?.landkreis) {
                    query = query.ilike('landkreis', filters.landkreis);
                }
                if (filters?.bundesland) {
                    query = query.eq('bundesland', filters.bundesland);
                }
                if (filters?.minNote) {
                    query = query.gte('zustandsnote', filters.minNote);
                }
                if (filters?.limit) {
                    query = query.limit(filters.limit);
                } else {
                    query = query.limit(5000);
                }

                const { data, error } = await query;

                if (!cancelled) {
                    if (error) {
                        setState({ data: null, loading: false, error: error.message });
                    } else {
                        setState({ data: data as Bridge[], loading: false, error: null });
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setState({ data: null, loading: false, error: String(err) });
                }
            }
        }

        void fetchBridges();
        return () => {
            cancelled = true;
        };
    }, [filters?.landkreis, filters?.bundesland, filters?.minNote, filters?.limit]);

    return state;
}

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

export function useBridgesGeoJSON() {
    const [state, setState] = useState<DataState<GeoJSON.FeatureCollection>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        async function fetchAll() {
            setState((prev) => ({ ...prev, loading: true }));

            try {
                // Paginate to get ALL ~40k bridges
                const allBridges = await fetchAllRows<MinimalBridge>(
                    'bruecken',
                    'bauwerksnummer, name, lat, lng, zustandsnote, baujahr, strasse, landkreis, bundesland'
                );

                if (!cancelled) {
                    const geojson: GeoJSON.FeatureCollection = {
                        type: 'FeatureCollection',
                        features: allBridges
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
                            })),
                    };
                    setState({ data: geojson, loading: false, error: null });
                }
            } catch (err) {
                if (!cancelled) {
                    setState({ data: null, loading: false, error: String(err) });
                }
            }
        }

        void fetchAll();
        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}

export function useLandkreise() {
    const [state, setState] = useState<DataState<LandkreisStats[]>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        async function fetchStats() {
            // Fetch all rows (may exceed 1000 Landkreise with fragmented names)
            const allStats = await fetchAllRows<Record<string, unknown>>(
                'landkreis_stats',
                '*'
            );

            if (!cancelled) {
                // Merge fragmented Landkreis entries (same slug = same Landkreis)
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
                        // Weighted merge
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
                        // Keep the shorter/cleaner name version
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

                const sorted = Array.from(merged.values()).sort((a, b) => b.avg_note - a.avg_note);
                setState({ data: sorted, loading: false, error: null });
            }
        }

        fetchStats().catch((err) => {
            if (!cancelled) {
                setState({ data: null, loading: false, error: String(err) });
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}

export function useGlobalStats() {
    const [stats, setStats] = useState<{
        totalBridges: number;
        criticalCount: number;
        criticalPercent: number;
        avgBaujahr: number;
        avgNote: number;
    } | null>(null);

    useEffect(() => {
        async function fetch() {
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

            setStats({
                totalBridges: total,
                criticalCount: critical,
                criticalPercent: total > 0 ? Math.round((critical / total) * 1000) / 10 : 0,
                avgBaujahr: avgData?.[0]?.avg_baujahr ?? 0,
                avgNote: avgData?.[0]?.avg_note ?? 0,
            });
        }

        void fetch();
    }, []);

    return stats;
}

export function useLandkreisBySlug(slug: string) {
    const { data: landkreise } = useLandkreise();
    const match = landkreise?.find((lk) => lk.slug === slug) ?? null;
    return { landkreis: match };
}
