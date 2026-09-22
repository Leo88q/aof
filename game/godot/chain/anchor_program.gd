class_name AnchorProgram
extends RefCounted
## AnchorProgram — instruction builder for AOF_CORE_PROGRAM_ID / CgInv111... /
## SessKeys111... / STrEaSuRy111... Anchor IDLs.

var program_id: String

func _init(id: String) -> void:
	program_id = id

func build(name: String, args: Dictionary, accounts: Array) -> Dictionary:
	return {"programId": program_id, "ix": name, "args": args, "accounts": accounts}

func events_of(signature: String) -> Array: return []  # server-side verification hook
