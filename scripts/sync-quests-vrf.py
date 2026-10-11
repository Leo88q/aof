#!/usr/bin/env python3
"""Refuse a second randomness implementation in aof-quests.

Randomness lives only in aof-core/src/vrf.rs. The generated quests copy was
the drum/Switchboard fork. CI runs `--check`. Writing a copy is refused.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUESTS = ROOT / "programs/aof-quests/src/vrf.rs"


def main() -> int:
    if QUESTS.exists():
        print(f"{QUESTS.relative_to(ROOT)} must stay absent: randomness is only aof-core/src/vrf.rs")
        return 1
    print("aof-quests has no vrf.rs copy")
    return 0


if __name__ == "__main__":
    sys.exit(main())
