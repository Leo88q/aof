#!/usr/bin/env python3
"""Offline lamport cost model, NOT a live quote or a compression integration.
Feed measured rent/protocol/network/indexer costs. No keys, RPC writes or SDKs.
"""
import argparse
import json


def integer(data, key, minimum=0):
    value = data[key]
    if type(value) is not int or value < minimum:
        raise ValueError(f"{key} must be an integer >= {minimum}")
    return value


def estimate(data):
    count = integer(data, "assets", 1)
    result = {}
    for name in ("current_spl", "bubblegum_hybrid", "bubblegum_compressed_state"):
        mode = data[name]
        capacity = integer(mode, "capacity", 1)
        trees = (count + capacity - 1) // capacity
        fixed = integer(mode, "fixed_lamports") + trees * integer(mode, "tree_lamports")
        per_asset = sum(integer(mode, key) for key in (
            "asset_rent_lamports", "game_state_lamports", "protocol_fee_lamports", "network_fee_lamports"))
        total = fixed + count * per_asset + integer(mode, "operations_budget_lamports")
        result[name] = {"total_lamports": total, "lamports_per_asset_ceil": (total + count - 1) // count, "allocated_trees": trees if mode["tree_lamports"] else 0}
    base = result["current_spl"]["total_lamports"]
    for mode in result.values():
        mode["difference_vs_current_lamports"] = base - mode["total_lamports"]
    return {"assets": count, "input_label": data.get("label", "unlabelled assumptions"), "quotes_verified": False, "estimates": result}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="JSON assumptions file; see docs/audit/mint-cost-example.json")
    args = parser.parse_args()
    with open(args.input, encoding="utf-8") as file:
        print(json.dumps(estimate(json.load(file)), indent=2))
