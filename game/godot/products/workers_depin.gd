class_name AofProductWorkersDepin
extends Node
## Product: DePIN crafting-market workers — stake 10 SOL, escrow 0.1 SOL per 100
## players, reward per settled job, slash on miss (STrEaSuRy111... escrow).
const WORKER_STAKE_SOL := 10.0
const ESCROW_PER_100_PLAYERS := 0.1
func stake_worker(wallet: String) -> Dictionary: return {"stakeSol": WORKER_STAKE_SOL}
func settle_job(job_id: String) -> void: pass
func slash(worker: String, reason: String) -> void: pass
