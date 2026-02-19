import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Bridge, LandkreisStats } from '../types';
import { useDataContext } from '../contexts/DataProvider';
import { slugify } from '../utils/grading';

interface DataState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

// ── Context-backed hooks (cached across navigations) ──

export function useBridgesGeoJSON() {
    const { geojson, bridgeProgress } = useDataContext();
    return {
        data: geojson,
        loading: !bridgeProgress.done,
        progress: bridgeProgress,
    };
}

export function useLandkreise() {
    const { landkreise, landkreiseLoading } = useDataContext();
    return {
        data: landkreise,
        loading: landkreiseLoading,
        error: null,
    };
}

export function useGlobalStats() {
    const { globalStats } = useDataContext();
    return globalStats;
}

export function useLandkreisBySlug(slug: string) {
    const { landkreise } = useDataContext();
    const match = landkreise?.find((lk) => lk.slug === slug) ?? null;
    return { landkreis: match };
}

// ── Direct Supabase hooks (for page-specific filtered queries) ──

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
