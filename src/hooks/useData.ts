import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Bridge, LandkreisStats } from '../types';
import { slugify } from '../utils/grading';

interface DataState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
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

            let query = supabase
                .from('bruecken')
                .select(
                    'bauwerksnummer, name, lat, lng, zustandsnote, zustandsklasse, baujahr, strasse, ort, landkreis, bundesland, baustoffklasse, traglastindex, stand'
                )
                .order('zustandsnote', { ascending: false });

            if (filters?.landkreis) {
                query = query.eq('landkreis', filters.landkreis);
            }
            if (filters?.bundesland) {
                query = query.eq('bundesland', filters.bundesland);
            }
            if (filters?.minNote) {
                query = query.gte('zustandsnote', filters.minNote);
            }
            if (filters?.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;

            if (!cancelled) {
                if (error) {
                    setState({ data: null, loading: false, error: error.message });
                } else {
                    setState({ data: data as Bridge[], loading: false, error: null });
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

            const { data, error } = await supabase
                .from('bruecken')
                .select('bauwerksnummer, name, lat, lng, zustandsnote, baujahr, strasse, landkreis, bundesland')
                .not('lat', 'is', null);

            if (!cancelled) {
                if (error) {
                    setState({ data: null, loading: false, error: error.message });
                } else {
                    const geojson: GeoJSON.FeatureCollection = {
                        type: 'FeatureCollection',
                        features: (data ?? []).map((b) => ({
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
            const { data, error } = await supabase
                .from('landkreis_stats')
                .select('*')
                .order('avg_note', { ascending: false });

            if (!cancelled) {
                if (error) {
                    setState({ data: null, loading: false, error: error.message });
                } else {
                    const withSlugs = (data ?? []).map((d) => ({
                        ...d,
                        slug: slugify(d.landkreis ?? ''),
                    })) as LandkreisStats[];
                    setState({ data: withSlugs, loading: false, error: null });
                }
            }
        }

        void fetchStats();
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

    const match = landkreise?.find((lk) => slugify(lk.landkreis) === slug) ?? null;

    const fetchBridgesForLandkreis = useCallback(() => {
        if (!match) return { data: null, loading: true, error: null } as DataState<Bridge[]>;
        // This is a placeholder — actual usage will call useBridges with the landkreis filter
        return { data: null, loading: false, error: null } as DataState<Bridge[]>;
    }, [match]);

    return { landkreis: match, fetchBridges: fetchBridgesForLandkreis };
}
