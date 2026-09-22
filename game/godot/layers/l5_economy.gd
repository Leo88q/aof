class_name AofL5Economy
extends Node
## L5 Economy — farming / crafting / trading / marketplace loops.
## Crafting gamble uses Gamba (wager NFT, commit-reveal, house edge 5%, jackpot).

func plant(plot: Dictionary, seed_item: Dictionary) -> void: pass
func harvest(plot: Dictionary) -> Array: return []
func craft(recipe: Dictionary, materials: Array) -> Dictionary: return {}
func list_item(asset: Dictionary, venue: String) -> void: pass  # Tensor | Magic Eden | GameShift | Shyft escrow-less
