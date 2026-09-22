class_name SplBuilders
extends RefCounted
## SPL builders — ATA create, token mint/transfer/burn for Standard NFT
## (golden tools, land) and resource mints (seeds/crops/materials).

static func create_ata(owner: String, mint: String) -> Dictionary: return {"ix": "create_ata", "owner": owner, "mint": mint}
static func mint_to(mint: String, dest: String, amount: int) -> Dictionary: return {"ix": "mint_to", "mint": mint, "dest": dest, "amount": amount}
static func transfer(mint: String, src: String, dest: String, amount: int) -> Dictionary: return {"ix": "transfer", "mint": mint, "src": src, "dest": dest, "amount": amount}
