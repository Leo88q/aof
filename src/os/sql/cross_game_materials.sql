-- Watchtower OS v3 — cross-game материалы for tenant/game `aof`.
-- RLS tenant_id = 'aof' + materialized view (see docs/WATCHTOWER_OS_V3.md).
-- Safe to run on the shared PostgreSQL (PG + TimescaleDB) ledger database.

BEGIN;

CREATE TABLE IF NOT EXISTS cross_game_materials (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         TEXT        NOT NULL DEFAULT 'aof',   -- RLS tenant: aof
  game_id           TEXT        NOT NULL DEFAULT 'aof',
  source_game       TEXT        NOT NULL DEFAULT 'aof',   -- ARC Entity field source_game
  entity_kind       TEXT        NOT NULL CHECK (entity_kind IN ('crop', 'plot', 'item', 'tool', 'land')),
  arc_entity_id     TEXT        NOT NULL,                  -- ARC Entity-Component id
  bolt_entity_id    TEXT,                                  -- Bolt FOCG entity id
  asset_id          TEXT        NOT NULL,                  -- cNFT leaf / Standard NFT mint
  is_cnft           BOOLEAN     NOT NULL,
  growth_stage      SMALLINT    NOT NULL DEFAULT 0,        -- Core Attributes: GrowthStage
  position_x        INTEGER,
  position_y        INTEGER,                               -- Core Attributes: Position
  owner_wallet_hash TEXT        NOT NULL,                  -- sha256(WATCHTOWER_PLAYER_HASH_SALT|wallet)
  attributes        JSONB       NOT NULL DEFAULT '{}'::jsonb, -- Core Attributes key-value
  storage_ref       TEXT,                                  -- Xandeum pointer (farming state blob)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cross_game_materials_tenant_entity
  ON cross_game_materials (tenant_id, arc_entity_id);
CREATE INDEX IF NOT EXISTS cross_game_materials_asset
  ON cross_game_materials (asset_id);

-- ── RLS: every read/write is scoped to tenant_id = 'aof' ────────────────────
ALTER TABLE cross_game_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cross_game_materials_tenant_aof ON cross_game_materials;
CREATE POLICY cross_game_materials_tenant_aof ON cross_game_materials
  USING (tenant_id = current_setting('app.tenant', true) OR tenant_id = 'aof')
  WITH CHECK (tenant_id = 'aof');

-- ── Materialized view: cross-game materials roster (refreshed by indexer) ──
DROP MATERIALIZED VIEW IF EXISTS mv_cross_game_materials_aof;
CREATE MATERIALIZED VIEW mv_cross_game_materials_aof AS
SELECT
  entity_kind,
  arc_entity_id,
  bolt_entity_id,
  asset_id,
  is_cnft,
  count(*)                       AS items,
  max(growth_stage)              AS max_growth_stage,
  count(*) FILTER (WHERE storage_ref IS NOT NULL) AS with_xandeum_state,
  max(updated_at)                AS last_update
FROM cross_game_materials
WHERE tenant_id = 'aof' AND game_id = 'aof'
GROUP BY entity_kind, arc_entity_id, bolt_entity_id, asset_id, is_cnft;

CREATE UNIQUE INDEX IF NOT EXISTS mv_cross_game_materials_aof_uq
  ON mv_cross_game_materials_aof (entity_kind, arc_entity_id, asset_id);

COMMIT;

-- Refresh (indexer cron / watchtower read-model): REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cross_game_materials_aof;
