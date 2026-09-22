class_name AofL6Data
extends Node
## L6 Data — LaserStream gRPC (AOF_CORE_PROGRAM_ID + CgInv + SessKeys + STrEaSuRy),
## Shyft gPA 15ms + TOKEN_MINT/NFT_MINT callbacks, PG+Timescale+Redis ledger
## (idempotency, gap backfill, finalized reconciliation), Xandeum + PST + Core Attributes.

func subscribe_laserstream() -> void: pass
func shyft_gpa(owner: String) -> Array: return []
func on_shyft_callback(kind: String, payload: Dictionary) -> void:
	assert(kind in ["TOKEN_MINT", "NFT_MINT"])
