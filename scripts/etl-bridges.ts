/**
 * ETL Script: Fetch bridge data from BASt GeoServer → Supabase
 *
 * The BASt bridge viewer at https://via.bund.de/bast/br/map/ uses a GeoServer
 * backend at https://via.bund.de/bast/br/ows with WFS layer `bast-br:bast_tbl`.
 * This script paginates through all features, converts UTM32 → WGS84
 * coordinates, and upserts the data into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/etl-bridges.ts
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// Configuration
// ============================================

const BAST_OWS_URL = 'https://via.bund.de/bast/br/ows';
const WFS_LAYER = 'bast-br:bast_tbl';
const PAGE_SIZE = 1000;
const REQUEST_DELAY_MS = 500;
const UPSERT_BATCH_SIZE = 500;

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// UTM32 → WGS84 Conversion
// ============================================

function utm32ToWgs84(easting: number, northing: number): { lat: number; lng: number } {
    const k0 = 0.9996;
    const a = 6378137.0;
    const e = 0.0818191908;
    const e2 = e * e;
    const ep2 = e2 / (1 - e2);

    const x = easting - 500000;
    const y = northing;

    const M = y / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64));

    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const phi1 =
        mu +
        (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu) +
        (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu) +
        (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);

    const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
    const T1 = Math.tan(phi1) * Math.tan(phi1);
    const C1 = ep2 * Math.cos(phi1) * Math.cos(phi1);
    const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
    const D = x / (N1 * k0);

    const lat =
        phi1 -
        ((N1 * Math.tan(phi1)) / R1) *
        (D * D / 2 -
            ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D * D * D * D) / 24 +
            ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) *
                D * D * D * D * D * D) /
            720);

    const lng =
        (D -
            ((1 + 2 * T1 + C1) * D * D * D) / 6 +
            ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) *
                D * D * D * D * D) /
            120) /
        Math.cos(phi1);

    const latDeg = (lat * 180) / Math.PI;
    const lngDeg = (lng * 180) / Math.PI + 9; // Central meridian zone 32

    return {
        lat: Math.round(latDeg * 1_000_000) / 1_000_000,
        lng: Math.round(lngDeg * 1_000_000) / 1_000_000,
    };
}

// ============================================
// BASt WFS Fetching — Simple Pagination
// ============================================

interface BastFeature {
    type: 'Feature';
    id: string;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: Record<string, unknown>;
}

interface BastResponse {
    type: 'FeatureCollection';
    features: BastFeature[];
    totalFeatures?: number;
    numberMatched?: number;
    numberReturned?: number;
}

async function fetchPage(startIndex: number): Promise<{ features: BastFeature[]; total: number | null }> {
    const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeName: WFS_LAYER,
        outputFormat: 'application/json',
        count: String(PAGE_SIZE),
        startIndex: String(startIndex),
        sortBy: 'bwnr',
    });

    const url = `${BAST_OWS_URL}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as BastResponse;
    const total = data.totalFeatures ?? data.numberMatched ?? null;
    return { features: data.features ?? [], total };
}

// ============================================
// Data Transformation
// ============================================

interface BridgeRow {
    bauwerksnummer: string;
    name: string;
    zustandsnote: number | null;
    zustandsklasse: string | null;
    baujahr: number | null;
    strasse: string | null;
    ort: string | null;
    landkreis: string | null;
    bundesland: string | null;
    baustoffklasse: string | null;
    traglastindex: number | null;
    laenge: number | null;
    breite: number | null;
    lat: number;
    lng: number;
    stand: string | null;
}

// Bundesland code → name mapping
const BL_MAP: Record<number, string> = {
    1: 'Schleswig-Holstein', 2: 'Hamburg', 3: 'Niedersachsen', 4: 'Bremen',
    5: 'Nordrhein-Westfalen', 6: 'Hessen', 7: 'Rheinland-Pfalz', 8: 'Baden-Württemberg',
    9: 'Bayern', 10: 'Saarland', 11: 'Berlin', 12: 'Brandenburg',
    13: 'Mecklenburg-Vorpommern', 14: 'Sachsen', 15: 'Sachsen-Anhalt', 16: 'Thüringen',
};

function transformFeature(feature: BastFeature): BridgeRow | null {
    const props = feature.properties;
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;

    const bwnr = String(props['bwnr'] ?? '').trim();
    if (!bwnr) return null;

    const { lat, lng } = utm32ToWgs84(coords[0]!, coords[1]!);
    if (lat < 47 || lat > 55.5 || lng < 5 || lng > 15.5) return null;

    const blCode = Number(props['bl'] ?? 0);
    const note = parseFloat(String(props['zn92019'] ?? ''));

    return {
        bauwerksnummer: bwnr,
        name: String(props['buildingname'] ?? 'Unbekannt').trim(),
        zustandsnote: note > 0 ? note : null,
        zustandsklasse: String(props['scoreclass'] ?? '').trim() || null,
        baujahr: Number(props['yearbuild']) || null,
        strasse: String(props['issue'] ?? '').trim() || null,
        ort: String(props['place'] ?? '').trim() || null,
        landkreis: String(props['state'] ?? '').trim() || null,
        bundesland: BL_MAP[blCode] ?? null,
        baustoffklasse: String(props['materialclass'] ?? '').trim() || null,
        traglastindex: null, // capacityindex is Roman numeral (I, II, III...), not numeric
        laenge: Number(props['length']) || null,
        breite: Number(props['width']) || null,
        lat,
        lng,
        stand: String(props['updated'] ?? '').trim() || null,
    };
}

// ============================================
// Supabase Upsert
// ============================================

async function upsertBridges(bridges: BridgeRow[]): Promise<number> {
    let inserted = 0;
    for (let i = 0; i < bridges.length; i += UPSERT_BATCH_SIZE) {
        const batch = bridges.slice(i, i + UPSERT_BATCH_SIZE);
        const { error } = await supabase
            .from('bruecken')
            .upsert(batch, { onConflict: 'bauwerksnummer' });

        if (error) {
            console.error(`  ❌ Upsert error at batch ${i}: ${error.message}`);
        } else {
            inserted += batch.length;
        }
    }
    return inserted;
}

// ============================================
// Main
// ============================================

async function main() {
    console.log('🚨 InfraMap ETL — BASt Bridge Data Pipeline');
    console.log('============================================\n');
    console.log(`🌐 Source: ${BAST_OWS_URL} (layer: ${WFS_LAYER})`);
    console.log(`💾 Target: ${SUPABASE_URL}\n`);

    const allBridges: BridgeRow[] = [];
    let startIndex = 0;
    let totalFeatures: number | null = null;
    let pagesWithNoData = 0;

    console.log('📥 Fetching bridges via WFS pagination...\n');

    while (true) {
        try {
            const { features, total } = await fetchPage(startIndex);
            if (total !== null && totalFeatures === null) {
                totalFeatures = total;
                console.log(`   Total features reported by server: ${total}\n`);
            }

            if (features.length === 0) {
                pagesWithNoData++;
                if (pagesWithNoData >= 3) break; // 3 consecutive empty pages = done
                startIndex += PAGE_SIZE;
                continue;
            }

            pagesWithNoData = 0;

            for (const f of features) {
                const row = transformFeature(f);
                if (row) allBridges.push(row);
            }

            const pct = totalFeatures ? Math.round((startIndex / totalFeatures) * 100) : '?';
            process.stdout.write(
                `\r  Page ${Math.floor(startIndex / PAGE_SIZE) + 1} | ${allBridges.length} bridges | ${pct}%`
            );

            startIndex += features.length;
            if (totalFeatures && startIndex >= totalFeatures) break;

            await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
        } catch (err) {
            console.error(`\n  ❌ Error at index ${startIndex}: ${String(err)}`);
            await new Promise((r) => setTimeout(r, 2000));
            // Retry
        }
    }

    console.log(`\n\n✅ Fetched ${allBridges.length} bridges\n`);

    if (allBridges.length === 0) {
        console.error('❌ No bridges fetched. Check the WFS layer name.');
        process.exit(1);
    }

    // Deduplicate by bauwerksnummer
    const deduped = new Map<string, BridgeRow>();
    for (const b of allBridges) {
        deduped.set(b.bauwerksnummer, b);
    }
    const unique = Array.from(deduped.values());
    console.log(`   Unique bridges (after dedup): ${unique.length}\n`);

    // Upsert to Supabase
    console.log('💾 Upserting to Supabase...');
    const inserted = await upsertBridges(unique);
    console.log(`✅ Upserted ${inserted} bridge records\n`);

    // Refresh materialized view
    console.log('📊 Refreshing landkreis_stats materialized view...');
    const { error: refreshError } = await supabase.rpc('refresh_landkreis_stats');
    if (refreshError) {
        console.log(`  ⚠️ Could not refresh view via RPC: ${refreshError.message}`);
        console.log('  Run manually: REFRESH MATERIALIZED VIEW landkreis_stats;');
    } else {
        console.log('✅ View refreshed\n');
    }

    // Stats
    const withNote = unique.filter((b) => b.zustandsnote !== null);
    const critical = withNote.filter((b) => b.zustandsnote !== null && b.zustandsnote >= 3.0);
    const landkreise = new Set(unique.map((b) => b.landkreis).filter(Boolean));
    const bundeslaender = new Set(unique.map((b) => b.bundesland).filter(Boolean));

    console.log('📈 Summary:');
    console.log(`   Total bridges:      ${unique.length}`);
    console.log(`   With Zustandsnote:  ${withNote.length}`);
    console.log(`   Critical (≥3.0):    ${critical.length} (${Math.round((critical.length / Math.max(withNote.length, 1)) * 100)}%)`);
    console.log(`   Landkreise:         ${landkreise.size}`);
    console.log(`   Bundesländer:       ${bundeslaender.size}`);
    console.log('\n🏁 ETL complete!');
}

main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
