class_name AofProductSessionWallet
extends Node
## Product: session wallet — Privy guest + embedded wallet + gas sponsorship;
## Session Keys createSession(AOF_CORE_PROGRAM_ID), topUp 0.01 SOL, expiry 60 min.
var keys: SessionKeys = SessionKeys.new()
func open(wallet: String) -> Dictionary: return keys.create_session(wallet)
func top_up() -> float: return keys.top_up()
