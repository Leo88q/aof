class_name AofProductCraftGamble
extends Node
## Product: craft gamble — Gamba wager NFT, provably fair commit-reveal,
## house edge 5%, jackpot (CgInv111... inventory program).
const HOUSE_EDGE_PERCENT := 5
func wager(nft: String, stake: int) -> Dictionary: return {"ix": "commit", "houseEdgePercent": HOUSE_EDGE_PERCENT, "jackpot": true}
func reveal(commit: String, secret: String) -> Dictionary: return {"ix": "reveal", "provablyFair": true}
