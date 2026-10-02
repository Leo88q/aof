#!/usr/bin/env python3
"""Гейт осиротевших записей IDL.

Anchor не запускается в песочнице, поэтому committed IDL — «source-aligned manually;
generated validation pending». Этот гейт не даёт committed IDL накапливать записи,
которых больше нет в исходниках программы: account-контексты, типы, события и ошибки.

Критерий (важен для замечания владельца про shared types): запись считается осиротевшей,
только если её имени нет **нигде** в исходниках программы. Общий тип, который ещё
использует хотя бы одна инструкция, остаётся — он не «принадлежал» удалённой инструкции.

Usage: python3 scripts/check-idl-orphans.py [--root DIR]
"""
from __future__ import annotations

import argparse
import json
import os
import sys

PROGRAMS = {
    "aof_core": ["aof-core/src"],
    "aof_market": ["programs/aof-market/src"],
    "aof_quests": ["programs/aof-quests/src"],
    "aof_liquidity": ["programs/aof-liquidity/src"],
    "aof_rebirth": ["programs/aof-rebirth/src"],
    "aof_session_keys": ["programs/aof-session-keys/src"],
}


def read_sources(root: str, dirs: list[str]) -> str:
    text = ""
    for d in dirs:
        base = os.path.join(root, d)
        if not os.path.isdir(base):
            continue
        for cur, _sub, files in os.walk(base):
            for f in files:
                if f.endswith(".rs"):
                    text += open(os.path.join(cur, f), encoding="utf-8").read()
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    errors: list[str] = []
    checked = 0
    for program, dirs in sorted(PROGRAMS.items()):
        idl_path = os.path.join(root, "aof_backend/src/idl", f"{program}.json")
        if not os.path.exists(idl_path):
            errors.append(f"{program}: нет {os.path.relpath(idl_path, root)}")
            continue
        idl = json.load(open(idl_path, encoding="utf-8"))
        src = read_sources(root, dirs)
        if not src:
            errors.append(f"{program}: не найдены исходники {dirs}")
            continue
        checked += 1
        instruction_names = {i["name"] for i in idl.get("instructions", [])}
        for key in ("accounts", "types", "events"):
            for entry in idl.get(key, []):
                if entry["name"] not in src:
                    errors.append(f"{program}: осиротевшая запись {key}/{entry['name']} — нет в исходниках")
        for err in idl.get("errors", []):
            if err["name"] not in src:
                errors.append(f"{program}: осиротевшая ошибка {err['name']} — нет в исходниках")
        for key in ("types", "events", "accounts"):
            for entry in idl.get(key, []):
                if entry["name"] in instruction_names and key != "accounts":
                    errors.append(f"{program}: {key}/{entry['name']} совпадает с именем инструкции — подозрительная запись")
    if errors:
        print(f"idl-orphans: {len(errors)} проблем(ы):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"idl-orphans: чисто ({checked} IDL, каждая запись есть в исходниках программы)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
