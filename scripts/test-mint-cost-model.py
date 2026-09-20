import importlib.util
import json
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location("cost", Path(__file__).with_name("mint-cost-model.py"))
cost = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cost)

class CostModelTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((Path(__file__).parents[1] / "docs/audit/mint-cost-example.json").read_text())
    def test_example(self):
        result = cost.estimate(self.data)["estimates"]
        self.assertEqual(result["current_spl"]["total_lamports"], 55_273_200_000)
        self.assertEqual(result["bubblegum_hybrid"]["allocated_trees"], 1)
        self.assertGreater(result["bubblegum_hybrid"]["total_lamports"], 20_000_000_000)
    def test_capacity_and_realized_fill(self):
        self.data["assets"] = 16385
        self.assertEqual(cost.estimate(self.data)["estimates"]["bubblegum_hybrid"]["allocated_trees"], 2)
        self.data["assets"] = 1
        self.assertLess(cost.estimate(self.data)["estimates"]["bubblegum_hybrid"]["difference_vs_current_lamports"], 0)
    def test_invalid_money(self):
        for value in [-1, 0.1, True, "1"]:
            self.data["current_spl"]["protocol_fee_lamports"] = value
            with self.assertRaises(ValueError): cost.estimate(self.data)

if __name__ == "__main__": unittest.main()
