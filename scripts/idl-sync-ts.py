#!/usr/bin/env python3
"""Regenerate the camelCase TS type helper of a committed Anchor IDL.

Anchor's IDL builder cannot run on the pinned toolchain (see the advisory IDL
step in .github/workflows/ci.yml), so the IDLs under aof_backend/src/idl/ are
maintained by hand. `aof_core.ts` is the camelCase copy that `anchor build`
used to emit next to `aof_core.json`; this script derives it from the JSON with
the rules the committed copy was generated with: every `name` key converted
by the `camelcase` npm package (v6 semantics); PDA seed `path`/`account`
values and docs (ASCII-escaped) are left as they are.

    python3 scripts/idl-sync-ts.py            # rewrite aof_core.ts
    python3 scripts/idl-sync-ts.py --check    # exit 1 if it is stale

scripts/check-idl-drift.py then verifies the JSON against the Rust sources and
the TS copy against the JSON.
"""
from __future__ import annotations

import json
import re
import sys

JSON_PATH = "aof_backend/src/idl/aof_core.json"
TS_PATH = "aof_backend/src/idl/aof_core.ts"
KEYS = {"name"}
HEADER = (
    "/**\n"
    " * Program IDL in camelCase format in order to be used in JS/TS.\n"
    " *\n"
    " * Note that this is only a type helper and is not the actual IDL. The original\n"
    " * IDL can be found at `target/idl/aof_core.json`.\n"
    " */\n"
    "export type AofCore = "
)


def _preserve_camel_case(s: str) -> str:
    """Port of camelcase@6 preserveCamelCase: split 'fooBar'/'FOOBar' runs."""
    last_lower = last_upper = last_last_upper = False
    i = 0
    while i < len(s):
        c = s[i]
        if last_lower and c.isupper():
            s = s[:i] + "-" + s[i:]
            last_lower, last_last_upper, last_upper = False, last_upper, True
            i += 1
        elif last_upper and last_last_upper and c.islower():
            s = s[: i - 1] + "-" + s[i - 1:]
            last_last_upper, last_upper, last_lower = last_upper, False, True
        else:
            last_lower = c.lower() == c and c.upper() != c
            last_last_upper = last_upper
            last_upper = c.upper() == c and c.lower() != c
        i += 1
    return s


def camelcase(value: str) -> str:
    s = value.strip()
    if not s:
        return ""
    if len(s) == 1:
        return s.lower()
    if s != s.lower():
        s = _preserve_camel_case(s)
    s = re.sub(r"^[_.\- ]+", "", s).lower()
    s = re.sub(r"[_.\- ]+([A-Za-z0-9_]|$)", lambda m: m.group(1).upper(), s)
    return re.sub(r"\d+([A-Za-z0-9_]|$)", lambda m: m.group(0).upper(), s)


def _to_camel(value):
    if isinstance(value, list):
        return [_to_camel(v) for v in value]
    return ".".join(camelcase(part) for part in value.split("."))


def convert(obj):
    if isinstance(obj, dict):
        return {k: (_to_camel(v) if k in KEYS and isinstance(v, (str, list)) else convert(v))
                for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert(v) for v in obj]
    return obj


def render(idl: dict) -> str:
    text = json.dumps(convert(idl), indent=2, ensure_ascii=True)
    # The committed copy keeps the metadata description unescaped (rebrand edit).
    desc = (idl.get("metadata") or {}).get("description")
    if desc:
        escaped = json.dumps(desc, ensure_ascii=True)
        text = text.replace('"description": ' + escaped, '"description": ' + json.dumps(desc, ensure_ascii=False), 1)
    return HEADER + text + ";\n"


def main() -> int:
    idl = json.load(open(JSON_PATH, encoding="utf-8"))
    text = render(idl)
    if "--check" in sys.argv:
        current = open(TS_PATH, encoding="utf-8").read()
        if current != text:
            print(f"{TS_PATH} is stale: run python3 scripts/idl-sync-ts.py")
            return 1
        print(f"{TS_PATH} is up to date")
        return 0
    open(TS_PATH, "w", encoding="utf-8").write(text)
    print(f"wrote {TS_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
