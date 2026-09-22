class_name WalletAdapter
extends RefCounted
## WalletAdapter — Privy (guest + embedded wallet + gas sponsorship), Phantom
## FirstStep, Altude. Auto cross-game wallet link (RACE + idosgames).

signal connected(wallet: String)

func connect(kind: String) -> String:
	assert(kind in ["privy", "phantom-firststep", "altude"])
	connected.emit(kind + ":wallet")
	return kind + ":wallet"

func link_cross_game() -> Dictionary:
	return {"studio_pda": "studio_profile", "providers": ["RACE", "idosgames"]}
