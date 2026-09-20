#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("gate", pathlib.Path(__file__).with_name("check-idl-drift.py"))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

class AbiGate(unittest.TestCase):
    def test_exact_types_and_discriminator(self):
        src = '#[program] pub mod example {\npub fn buy(ctx: Context<Buy>, max: u64, expiry: i64, id: [u8; 32]) -> Result<()> { Ok(()) }\n}'
        parsed = gate.parse_instructions(src)
        ix = {"name": "buy", "args": [{"name": "max", "type": "u64"}, {"name": "expiry", "type": "i64"}, {"name": "id", "type": {"array": ["u8", 32]}}], "accounts": [], "discriminator": list(hashlib.sha256(b"global:buy").digest()[:8])}
        def problems(instruction):
            result = []
            gate.compare("example", parsed, {"Buy": []}, {"instructions": [instruction]}, "test", result)
            return result
        self.assertEqual(problems(ix), [])
        for change in ["signedness", "order", "name", "discriminator"]:
            mutated = copy.deepcopy(ix)
            if change == "signedness": mutated["args"][0]["type"] = "i64"
            elif change == "order": mutated["args"].reverse()
            elif change == "name": mutated["args"][0]["name"] = "min"
            else: mutated["discriminator"][0] ^= 1
            self.assertTrue(problems(mutated), change)
    def test_wire_aliases(self):
        self.assertEqual(gate.rust_idl_type("Vec<u8>"), "bytes")
        self.assertEqual(gate.rust_idl_type("Vec<Pubkey>"), {"vec": "pubkey"})
        self.assertEqual(gate.rust_idl_type("ResourceKind"), {"defined": {"name": "ResourceKind"}})

if __name__ == "__main__": unittest.main()
