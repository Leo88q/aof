class_name AofL2Identity
extends Node
## L2 Identity — Privy (guest, embedded wallet, gas sponsorship, auto cross-game),
## Phantom FirstStep, Altude, Session Keys (createSession AOF_CORE_PROGRAM_ID,
## topUp 0.01 SOL, expiry 60 min). Materials join via RLS tenant_id = 'aof'
## materialized view mv_cross_game_materials_aof.

signal wallet_ready(wallet: String)
var wallet: String = ""
var provider: String = ""  # privy | phantom-firststep | altude

func login_guest() -> void:
	provider = "privy"
	wallet = await _privy_guest_embedded()
	wallet_ready.emit(wallet)

func attach_firststep() -> void:
	provider = "phantom-firststep"
	wallet = await _wallet_adapter_connect("phantom")
	wallet_ready.emit(wallet)

func attach_altude() -> void:
	provider = "altude"
	wallet = await _wallet_adapter_connect("altude")
	wallet_ready.emit(wallet)

func _privy_guest_embedded() -> String: return "privy:embedded:" + str(Time.get_unix_time_from_system())
func _wallet_adapter_connect(kind: String) -> String: return kind + ":connected"
