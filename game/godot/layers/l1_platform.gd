class_name AofL1Platform
extends Node
## L1 Platform — loop, config, HTTP to Watchtower OS v3 (gameId aof, network stage/prototype).
const GAME_ID := "aof"
const NETWORK := "stage"
const STAGE := "prototype"

func boot() -> void:
	var cfg: Dictionary = WatchtowerOS.config()
	assert(cfg.get("componentsTotal", 33) == 33)  # ideal free stack v3
	print("AOF v3 booted: ", cfg.get("stack", ""))
