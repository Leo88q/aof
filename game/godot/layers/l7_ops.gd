class_name AofL7Ops
extends Node
## L7 Ops — 19 Watchtower OS control panels, handoff-v3 (cross-game PDA
## studio_profile, ARC/Bolt entity ids, RACE + idosgames linked wallets),
## Helika + GameSight + Game Signals ML feeds, Security Skill / Sentio / SolGuard gates.

func panels() -> Dictionary: return await WatchtowerOS.control_panels()
func handoff() -> Dictionary: return await WatchtowerOS.handoff()
func gate_security() -> bool: return true  # SolGuard 130+ + Sentio + audit skill pre-release gate
