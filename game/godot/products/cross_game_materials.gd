class_name AofProductCrossGameMaterials
extends Node
## Product: cross-game materials — PDA studio_profile (AOF_CORE_PROGRAM_ID),
## ARC Entity IDs + Bolt entity IDs, linked wallets RACE + idosgames bridge,
## storage Xandeum + Core Attributes; RLS tenant_id = 'aof' +
## materialized view mv_cross_game_materials_aof (src/os/sql/cross_game_materials.sql).
const STUDIO_PDA_SEED := "studio_profile"
func export_materials() -> Dictionary: return {"rls": "tenant_id = 'aof'", "view": "mv_cross_game_materials_aof"}
func import_materials(bundle: Dictionary) -> void: pass
