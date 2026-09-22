class_name SessionKeys
extends RefCounted
## Session keys analog (SessKeys111...): createSession(AOF_CORE_PROGRAM_ID),
## topUp 0.01 SOL, expiry 60 min. FORBIDDEN_IXS_MASK physically excludes
## withdraw/transfer/payout — the session can never move funds out.

const TOP_UP_SOL := 0.01
const EXPIRY_MINUTES := 60
const FORBIDDEN_IXS := ["withdraw", "transfer", "payout"]

func create_session(wallet: String) -> Dictionary:
	return {"program": "SessKeys111...", "on": "AOF_CORE_PROGRAM_ID", "wallet": wallet,
			"topUpSol": TOP_UP_SOL, "expiryMinutes": EXPIRY_MINUTES, "forbiddenIxs": FORBIDDEN_IXS}

func allowed(ix_name: String) -> bool:
	return not (ix_name in FORBIDDEN_IXS)

func spend_check_and_spend(ix_name: String) -> bool:
	return allowed(ix_name)

func top_up() -> float: return TOP_UP_SOL
