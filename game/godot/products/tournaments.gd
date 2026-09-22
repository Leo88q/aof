class_name AofProductTournaments
extends Node
## Product: tournaments — RitArena crop tournaments (best free, chosen over Aureus),
## lifecycle + retry events (max 5 retries, exponential backoff).
func register(fighter_nft: String) -> void: pass
func play(bracket_id: String) -> void: pass
func on_lifecycle_event(e: Dictionary) -> void: pass  # retry-aware
