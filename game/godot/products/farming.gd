class_name AofProductFarming
extends Node
## Product: farming — plots (ARC entity `plot`, Bolt `Plot`), crops (GrowthStage +
## Position via Core Attributes), plant/harvest (Bolt systems). Magic Actions
## auto-harvest runs gasless on MagicBlock ER.
func plant(plot_id: String, seed: Dictionary) -> void: pass
func harvest(plot_id: String) -> Array: return []
func auto_harvest_magic_action() -> void: pass
