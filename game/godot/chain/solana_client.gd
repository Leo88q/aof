class_name SolanaClient
extends RefCounted
## SolanaClient — JSON-RPC client (stage/prototype: devnet RPC). Commitment finalized.

const RPC_URL := "https://api.devnet.solana.com"

func get_slot() -> int: return 0
func get_account_info(address: String) -> Dictionary: return {}
func send_transaction(raw: PackedByteArray) -> String: return ""
func commit_state(tx: Dictionary) -> void: pass  # MagicBlock ER commit
