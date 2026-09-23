-- Run after src/os/sql/cross_game_materials.sql in a DISPOSABLE PostgreSQL 15+
-- database as administrator. All fixture rows, roles and grants roll back.
BEGIN;
CREATE ROLE test_other_game NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT SELECT, INSERT ON cross_game_materials TO test_other_game;
GRANT USAGE ON SEQUENCE cross_game_materials_id_seq TO test_other_game;
INSERT INTO cross_game_materials (tenant_id, game_id, entity_kind, arc_entity_id, asset_id, is_cnft, owner_wallet_hash)
VALUES ('aof', 'aof', 'item', 'test-aof', 'test-asset', false, 'hash-aof'),
       ('other', 'other', 'item', 'test-other', 'test-other-asset', false, 'hash-other');
-- More than one Bolt entity for the same asset must not break refresh's index.
INSERT INTO cross_game_materials (tenant_id, game_id, entity_kind, arc_entity_id, bolt_entity_id, asset_id, is_cnft, owner_wallet_hash)
VALUES ('aof', 'aof', 'item', 'test-aof', 'bolt-2', 'test-asset', false, 'hash-aof');
REFRESH MATERIALIZED VIEW mv_cross_game_materials_aof;

SET LOCAL ROLE aof_materials_reader;
SET LOCAL app.tenant = 'aof';
DO $$ BEGIN
  IF (SELECT count(*) FROM cross_game_materials WHERE arc_entity_id LIKE 'test-%') <> 2 THEN
    RAISE EXCEPTION 'aof reader did not see exactly its two fixture rows';
  END IF;
  IF EXISTS (SELECT FROM mv_cross_game_materials_aof WHERE arc_entity_id = 'test-other') THEN
    RAISE EXCEPTION 'materialized view contains another tenant';
  END IF;
END $$;
SET LOCAL app.tenant = 'other';
DO $$ BEGIN
  IF EXISTS (SELECT FROM cross_game_materials) THEN
    RAISE EXCEPTION 'aof reader bypassed tenant scope';
  END IF;
END $$;
SET LOCAL app.tenant = '';
DO $$ BEGIN
  IF EXISTS (SELECT FROM cross_game_materials) THEN
    RAISE EXCEPTION 'missing tenant must deny all rows';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE aof_materials_writer;
SET LOCAL app.tenant = 'aof';
DO $$ BEGIN
  BEGIN
    UPDATE cross_game_materials SET tenant_id = 'other' WHERE arc_entity_id = 'test-aof';
    RAISE EXCEPTION 'cross-tenant update allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO cross_game_materials (tenant_id, entity_kind, arc_entity_id, asset_id, is_cnft, owner_wallet_hash)
    VALUES ('other', 'item', 'bad', 'bad', false, 'bad');
    RAISE EXCEPTION 'cross-tenant insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE test_other_game;
-- An attacker can change a custom GUC: it must not grant aof role privileges.
SET LOCAL app.tenant = 'aof';
DO $$ BEGIN
  IF EXISTS (SELECT FROM cross_game_materials) THEN
    RAISE EXCEPTION 'another role saw aof by spoofing app.tenant';
  END IF;
  BEGIN
    PERFORM * FROM mv_cross_game_materials_aof;
    RAISE EXCEPTION 'another role read the materialized view';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
