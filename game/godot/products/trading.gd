class_name AofProductTrading
extends Node
## Product: trading — P2P offers/orderbook (aof_market), Shyft escrow-less fills,
## private sealed-bid offers via PST.
func make_offer(asset_id: String, price_lamports: int) -> Dictionary: return {}
func take_offer(offer_id: String) -> Dictionary: return {}
func sealed_bid(amount: int) -> Dictionary: return {"via": "pst"}
