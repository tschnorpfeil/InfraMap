/**
 * ETL Script: Fetch bridge data from BASt GeoServer → Supabase
 *
 * The BASt bridge viewer at https://via.bund.de/bast/br/map/ uses a GeoServer
 * backend at https://via.bund.de/bast/br/ows. This script queries it
 * systematically using WFS GetFeature requests, converts UTM32 → WGS84
 * coordinates, and upserts the data into a Supabase PostGIS table.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/etl-bridges.ts
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// Configuration
// ============================================

const BAST_OWS_URL = 'https://via.bund.de/bast/br/ows';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Germany bounding box in EPSG:25832 (UTM32)
const GERMANY_BBOX_UTM32 = {
    minX: 280000,
    maxX: 920000,
    minY: 5230000,
    maxY: 6110000,
};

// Grid tile size (meters) — smaller = more precise but more requests
const TILE_SIZE = 50000; // 50km tiles

// Delay between requests (ms) — be polite to the server
const REQUEST_DELAY_MS = 300;

// Batch size for Supabase upserts
const UPSERT_BATCH_SIZE = 500;

// ============================================
// UTM32 → WGS84 Conversion (simple formulas)
// ============================================

function utm32ToWgs84(easting: number, northing: number): { lat: number; lng: number } {
    // Using a simplified conversion. For production accuracy, use proj4.
    // This gives ~10m accuracy which is sufficient for bridge locations.
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

    // Convert to degrees and add central meridian for zone 32 (9°E)
    const latDeg = (lat * 180) / Math.PI;
    const lngDeg = (lng * 180) / Math.PI + 9;

    return { lat: Math.round(latDeg * 1_000_000) / 1_000_000, lng: Math.round(lngDeg * 1_000_000) / 1_000_000 };
}

// ============================================
// BASt GeoServer Fetching
// ============================================

interface BastFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: Record<string, unknown>;
}

interface BastResponse {
    type: 'FeatureCollection';
    features: BastFeature[];
    totalFeatures?: number;
    numberReturned?: number;
}

async function fetchBridgeTile(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
): Promise<BastFeature[]> {
    const bbox = `${minX},${minY},${maxX},${maxY},EPSG:25832`;

    const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeName: 'bvwp:bruecken_offen',
        outputFormat: 'application/json',
        srsName: 'EPSG:25832',
        bbox,
        count: '10000',
    });

    const url = `${BAST_OWS_URL}?${params.toString()}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            // Try alternative layer name
            params.set('typeName', 'bast:bruecken');
            const url2 = `${BAST_OWS_URL}?${params.toString()}`;
            const response2 = await fetch(url2);

            if (!response2.ok) {
                console.warn(`  ⚠️ HTTP ${response2.status} for tile ${minX},${minY}`);
                return [];
            }

            const data = (await response2.json()) as BastResponse;
            return data.features ?? [];
        }

        const data = (await response.json()) as BastResponse;
        return data.features ?? [];
    } catch (err) {
        console.warn(`  ⚠️ Error fetching tile ${minX},${minY}: ${String(err)}`);
        return [];
    }
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

function transformFeature(feature: BastFeature): BridgeRow | null {
    const props = feature.properties;
    const coords = feature.geometry?.coordinates;

    if (!coords || coords.length < 2) return null;

    const bwnr = String(props['bwnr'] ?? props['bauwerksnummer'] ?? props['id'] ?? '');
    if (!bwnr) return null;

    const { lat, lng } = utm32ToWgs84(coords[0]!, coords[1]!);

    // Validate coordinates are within Germany
    if (lat < 47 || lat > 55.5 || lng < 5 || lng > 15.5) return null;

    return {
        bauwerksnummer: bwnr,
        name: String(props['buildingname'] ?? props['name'] ?? 'Unbekannt'),
        zustandsnote: parseFloat(String(props['zn92019'] ?? props['zustandsnote'] ?? '')) || null,
        zustandsklasse: String(props['scoreclass'] ?? props['zustandsklasse'] ?? '') || null,
        baujahr: parseInt(String(props['yearbuild'] ?? props['baujahr'] ?? ''), 10) || null,
        strasse: String(props['issue'] ?? props['strasse'] ?? '') || null,
        ort: String(props['place'] ?? props['ort'] ?? '') || null,
        landkreis: String(props['state'] ?? props['landkreis'] ?? '') || null,
        bundesland: String(props['bundesland'] ?? '') || null,
        baustoffklasse: String(props['materialclass'] ?? props['baustoffklasse'] ?? '') || null,
        traglastindex: parseFloat(String(props['capacityindex'] ?? props['traglastindex'] ?? '')) || null,
        laenge: parseFloat(String(props['length'] ?? props['laenge'] ?? '')) || null,
        breite: parseFloat(String(props['width'] ?? props['breite'] ?? '')) || null,
        lat,
        lng,
        stand: String(props['updated'] ?? props['stand'] ?? '') || null,
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
// Main ETL Pipeline
// ============================================

async function main() {
    console.log('🚨 InfraMap ETL — BASt Bridge Data Pipeline');
    console.log('============================================\n');

    const { minX, maxX, minY, maxY } = GERMANY_BBOX_UTM32;
    const tilesX = Math.ceil((maxX - minX) / TILE_SIZE);
    const tilesY = Math.ceil((maxY - minY) / TILE_SIZE);
    const totalTiles = tilesX * tilesY;

    console.log(`📐 Grid: ${tilesX}×${tilesY} = ${totalTiles} tiles (${TILE_SIZE / 1000}km each)`);
    console.log(`🌐 Source: ${BAST_OWS_URL}`);
    console.log(`💾 Target: ${SUPABASE_URL}\n`);

    const allBridges = new Map<string, BridgeRow>();
    let tileCount = 0;

    for (let xi = 0; xi < tilesX; xi++) {
        for (let yi = 0; yi < tilesY; yi++) {
            tileCount++;
            const tileMinX = minX + xi * TILE_SIZE;
            const tileMinY = minY + yi * TILE_SIZE;
            const tileMaxX = Math.min(tileMinX + TILE_SIZE, maxX);
            const tileMaxY = Math.min(tileMinY + TILE_SIZE, maxY);

            process.stdout.write(
                `\r  Tile ${tileCount}/${totalTiles} (${Math.round((tileCount / totalTiles) * 100)}%) — ${allBridges.size} bridges found`
            );

            const features = await fetchBridgeTile(tileMinX, tileMinY, tileMaxX, tileMaxY);

            for (const f of features) {
                const row = transformFeature(f);
                if (row) {
                    allBridges.set(row.bauwerksnummer, row);
                }
            }

            // Rate limiting
            await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
        }
    }

    console.log(`\n\n✅ Fetched ${allBridges.size} unique bridges\n`);

    if (allBridges.size === 0) {
        console.log('⚠️ No bridges found. The GeoServer layer name may have changed.');
        console.log('   Try inspecting the network tab at https://via.bund.de/bast/br/map/');
        console.log('   to find the correct WFS typeName.\n');

        // Try a GetCapabilities request to list available layers
        console.log('🔍 Attempting GetCapabilities...');
        try {
            const caps = await fetch(
                `${BAST_OWS_URL}?service=WFS&version=2.0.0&request=GetCapabilities`
            );
            const text = await caps.text();
            const layerMatches = text.match(/<Name>([^<]+)<\/Name>/g);
            if (layerMatches) {
                console.log('   Available layers:');
                layerMatches.forEach((m) => console.log(`     - ${m.replace(/<\/?Name>/g, '')}`));
            }
        } catch {
            console.log('   Could not retrieve capabilities.');
        }

        process.exit(1);
    }

    // Upsert to Supabase
    console.log('💾 Upserting to Supabase...');
    const bridgeArray = Array.from(allBridges.values());
    const inserted = await upsertBridges(bridgeArray);
    console.log(`✅ Upserted ${inserted} bridge records\n`);

    // Refresh materialized view
    console.log('📊 Refreshing landkreis_stats materialized view...');
    const { error: refreshError } = await supabase.rpc('refresh_landkreis_stats');
    if (refreshError) {
        console.log(`  ⚠️ Could not refresh view: ${refreshError.message}`);
        console.log('  You may need to run: REFRESH MATERIALIZED VIEW landkreis_stats;');
    } else {
        console.log('✅ Materialized view refreshed\n');
    }

    // Stats
    const withNote = bridgeArray.filter((b) => b.zustandsnote !== null);
    const critical = withNote.filter((b) => b.zustandsnote !== null && b.zustandsnote >= 3.0);
    console.log('📈 Summary:');
    console.log(`   Total bridges:     ${bridgeArray.length}`);
    console.log(`   With Zustandsnote: ${withNote.length}`);
    console.log(`   Critical (≥3.0):   ${critical.length} (${Math.round((critical.length / withNote.length) * 100)}%)`);
    console.log(`   Landkreise:        ${new Set(bridgeArray.map((b) => b.landkreis)).size}`);
    console.log('\n🏁 ETL complete!');
}

main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
