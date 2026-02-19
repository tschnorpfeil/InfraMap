-- ============================================
-- InfraMap: Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Bridges table
CREATE TABLE IF NOT EXISTS bruecken (
  bauwerksnummer TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Unbekannt',
  zustandsnote NUMERIC(2,1),
  zustandsklasse TEXT,
  baujahr INTEGER,
  strasse TEXT,
  ort TEXT,
  landkreis TEXT,
  bundesland TEXT,
  baustoffklasse TEXT,
  traglastindex NUMERIC(4,1),
  laenge NUMERIC(10,2),
  breite NUMERIC(10,2),
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  stand TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_bruecken_zustandsnote ON bruecken(zustandsnote);
CREATE INDEX IF NOT EXISTS idx_bruecken_landkreis ON bruecken(landkreis);
CREATE INDEX IF NOT EXISTS idx_bruecken_bundesland ON bruecken(bundesland);

-- 3. Materialized view for Landkreis stats
CREATE MATERIALIZED VIEW IF NOT EXISTS landkreis_stats AS
SELECT
  landkreis,
  bundesland,
  COUNT(*)::int AS total_bruecken,
  ROUND(AVG(zustandsnote)::numeric, 2) AS avg_note,
  COUNT(*) FILTER (WHERE zustandsnote >= 3.0)::int AS kritisch_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE zustandsnote >= 3.0) / NULLIF(COUNT(*), 0)::numeric, 1) AS kritisch_prozent,
  ROUND(AVG(baujahr)::numeric, 0)::int AS avg_baujahr,
  MIN(zustandsnote) AS beste_note,
  MAX(zustandsnote) AS schlechteste_note
FROM bruecken
WHERE zustandsnote IS NOT NULL AND landkreis IS NOT NULL AND landkreis != ''
GROUP BY landkreis, bundesland;

-- 4. Function to refresh the materialized view (called from ETL)
CREATE OR REPLACE FUNCTION refresh_landkreis_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW landkreis_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function for global stats (called from frontend)
CREATE OR REPLACE FUNCTION global_bridge_stats()
RETURNS TABLE(avg_note numeric, avg_baujahr numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(b.zustandsnote)::numeric, 2) AS avg_note,
    ROUND(AVG(b.baujahr)::numeric, 0) AS avg_baujahr
  FROM bruecken b
  WHERE b.zustandsnote IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Row Level Security — public read
ALTER TABLE bruecken ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read bruecken" ON bruecken;
CREATE POLICY "Public read bruecken" ON bruecken FOR SELECT USING (true);

-- Grant access to the materialized view
GRANT SELECT ON landkreis_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION global_bridge_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_landkreis_stats() TO authenticated, service_role;
