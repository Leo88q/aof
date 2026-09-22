class_name CandyMachine
extends RefCounted
## Candy Machine — cNFT drop minting through Bubblegum v2 Merkle Tree (MCC).
## Cost model: $110 per 1M compressed mints. Primary listing venue: Tensor.

func mint(claimer: String, item_type: String) -> Dictionary:
	return {"standard": "cNft", "protocol": "Bubblegum v2", "mcc": true, "mintCostUsdPerMillion": 110, "claimer": claimer, "itemType": item_type}
