class_name AofL3Chain
extends Node
## L3 Chain — SolanaClient + AnchorProgram wrappers (AOF_CORE_PROGRAM_ID,
## CgInv111..., SessKeys111..., STrEaSuRy111...), network stage/prototype.

const PROGRAMS := {
	"core": "AOF_CORE_PROGRAM_ID",
	"cginv": "CgInv111...",
	"sesskeys": "SessKeys111...",
	"treasury": "STrEaSuRy111...",
}

var client: SolanaClient
var programs: Dictionary = {}

func _ready() -> void:
	client = SolanaClient.new()
	for key in PROGRAMS:
		programs[key] = AnchorProgram.new(PROGRAMS[key])

func settle_magicblock(tx: Dictionary) -> void:
	# MagicBlock ER: delegate -> executeGasless -> commit state; REPLA L3 settle
	client.commit_state(tx)
