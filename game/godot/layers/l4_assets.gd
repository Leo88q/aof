class_name AofL4Assets
extends Node
## L4 Assets — common seeds/crops/materials -> cNFT $110/M (Bubblegum v2 Merkle
## Tree, MCC, Tensor primary); golden tools + land -> Standard NFT; GrowthStage +
## Position as Core Attributes (on-chain key-value, DAS 5ms); farming states -> Xandeum.

func strategy_for(item_type: String, rarity: String) -> Dictionary:
	return await WatchtowerOS.asset_strategy(item_type, rarity)

func mint_common(item_type: String) -> Dictionary:
	# cNFT via Candy Machine + Bubblegum v2 tree, listed primary on Tensor
	return await strategy_for(item_type, "common")

func mint_standard(item_type: String) -> Dictionary:
	# golden_tool | land -> Standard NFT with Core Attributes
	return await strategy_for(item_type, "legendary")
