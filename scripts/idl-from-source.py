#!/usr/bin/env python3
"""
Regenerate parts of a committed Anchor IDL from the Rust sources.

The Anchor IDL builder cannot run on the pinned toolchain (anchor-lang 0.30.1
needs proc_macro2::Span::source_file; see the advisory IDL step in
.github/workflows/ci.yml), so aof_backend/src/idl/*.json are maintained by
hand. This tool removes the hand-editing for the parts scripts/check-idl-drift.py
guards (instruction accounts, flags, args, discriminators) and for types,
events, accounts and errors, using the same source parser as the drift gate.

    python3 scripts/idl-from-source.py aof_core \
        --instructions pack_open_commit,pack_open_reveal \
        --types PackCommit,VrfSlot,VrfRevealParams \
        --accounts VrfSlot --events VrfCommitted --errors

Instructions/types/events/accounts that already exist are replaced in place;
new ones are appended at the end (the frontend instruction table depends on the
order, so existing entries never move). `--errors` rewrites the whole error
list from the #[error_code] enum (codes 6000 + declaration index).

PDA seeds are emitted only when every seed is a resolvable byte-string
constant or `<account>.key().as_ref()`; fixed addresses only for sysvars,
standard programs and the native mint. Cluster-specific addresses (the
Switchboard program and queue) are deliberately NOT embedded, so a client can
never silently fall back to the mainnet value on devnet.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("idl_drift", os.path.join(HERE, "check-idl-drift.py"))
drift = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drift)  # type: ignore[union-attr]

PROGRAM_TYPES = {
    "System": "11111111111111111111111111111111",
    "Token": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "AssociatedToken": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
}
FIXED_ADDRESSES = {
    "SLOT_HASHES_ID": "SysvarS1otHashes111111111111111111111111111",
    "anchor_lang::solana_program::sysvar::slot_hashes::ID": "SysvarS1otHashes111111111111111111111111111",
    "anchor_spl::token::spl_token::native_mint::ID": "So11111111111111111111111111111111111111112",
    "crate::vrf::ADDRESS_LOOKUP_TABLE_PROGRAM_ID": "AddressLookupTab1e1111111111111111111111111",
}


def disc(namespace: str, name: str) -> list[int]:
    return list(hashlib.sha256(f"{namespace}:{name}".encode()).digest()[:8])


def seed_constants(src: str) -> dict[str, bytes]:
    out = {}
    for m in re.finditer(r'pub const (\w+): &\[u8\] = b"([^"]*)";', src):
        out[m.group(1)] = m.group(2).encode()
    return out


def struct_fields_raw(src: str, name: str) -> list[tuple[str, str]]:
    """Fields (name, rust type) of `pub struct name { ... }` (non-Accounts)."""
    m = re.search(r"pub struct %s\s*\{(.*?)\n\}" % re.escape(name), src, re.S)
    if not m:
        raise SystemExit(f"struct {name} not found")
    body = drift.strip_comments(m.group(1))
    body = re.sub(r"#\[[^\]]*\]", "", body)
    return [(f.group(1), f.group(2).strip()) for f in re.finditer(r"pub (\w+):\s*([^,\n]+),", body)]


def accounts_struct_body(src: str, name: str) -> str:
    m = re.search(r"#\[derive\(Accounts\)\](?:\s*#\[instruction\(.*?\)\])?\s*pub struct %s<'info>\s*\{(.*?)\n\}"
                  % re.escape(name), src, re.S)
    if not m:
        raise SystemExit(f"accounts struct {name} not found")
    return drift.strip_comments(m.group(1))


def field_attrs(body: str) -> list[tuple[str, str, str]]:
    """(field, type, concatenated #[account(...)] bodies) in declaration order."""
    out = []
    prev = 0
    for f in re.finditer(r"^\s*pub (\w+):\s*(.+?),\s*$", body, re.M):
        out.append((f.group(1), f.group(2).strip(), drift.account_attrs(body[prev:f.start()])))
        prev = f.end()
    return out


def split_top(s: str, sep: str = ",") -> list[str]:
    parts, depth, start = [], 0, 0
    for i, ch in enumerate(s):
        if ch in "([{<":
            depth += 1
        elif ch in ")]}>":
            depth -= 1
        elif ch == sep and depth == 0:
            parts.append(s[start:i])
            start = i + 1
    parts.append(s[start:])
    return [p.strip() for p in parts if p.strip()]


def pda_of(attrs: str, consts: dict[str, bytes], fields: set[str]):
    m = re.search(r"\bseeds\s*=\s*\[", attrs)
    if not m:
        return None
    i, depth = m.end(), 1
    j = i
    while j < len(attrs) and depth:
        if attrs[j] == "[":
            depth += 1
        elif attrs[j] == "]":
            depth -= 1
        j += 1
    seeds = []
    for part in split_top(attrs[i:j - 1]):
        part = part.strip()
        if part in consts:
            seeds.append({"kind": "const", "value": list(consts[part])})
            continue
        km = re.fullmatch(r"(\w+)\.key\(\)\.as_ref\(\)", part)
        if km and km.group(1) in fields:
            seeds.append({"kind": "account", "path": km.group(1)})
            continue
        bm = re.fullmatch(r'b"([^"]*)"', part)
        if bm:
            seeds.append({"kind": "const", "value": list(bm.group(1).encode())})
            continue
        return None  # not expressible without guessing: omit the pda
    return {"seeds": seeds}


def address_of(attrs: str, ty: str):
    pm = re.fullmatch(r"Program<'info,\s*(\w+)>", ty)
    if pm and pm.group(1) in PROGRAM_TYPES:
        return PROGRAM_TYPES[pm.group(1)]
    am = re.search(r"\baddress\s*=\s*([\w:]+)", attrs)
    if am and am.group(1) in FIXED_ADDRESSES:
        return FIXED_ADDRESSES[am.group(1)]
    return None


def instruction_entry(name: str, src: str, consts: dict[str, bytes]) -> dict:
    ixs = drift.parse_instructions(src)
    if name not in ixs:
        raise SystemExit(f"instruction {name} not found in the #[program] module")
    ctx, args = ixs[name]
    flags = {f[0]: f for f in drift.parse_structs(src)[ctx]}
    body = accounts_struct_body(src, ctx)
    fa = field_attrs(body)
    names = {f[0] for f in fa}
    accounts = []
    for field, ty, attrs in fa:
        _, writable, signer, optional = flags[field]
        entry: dict = {"name": field}
        if writable:
            entry["writable"] = True
        if signer:
            entry["signer"] = True
        if optional:
            entry["optional"] = True
        addr = address_of(attrs, ty)
        if addr:
            entry["address"] = addr
        else:
            pda = pda_of(attrs, consts, names)
            if pda:
                entry["pda"] = pda
        accounts.append(entry)
    return {"name": name, "discriminator": disc("global", name), "accounts": accounts, "args": args}


def type_entry(name: str, src: str, enums: set[str]) -> dict:
    em = re.search(r"pub enum %s\s*\{(.*?)\n\}" % re.escape(name), src, re.S)
    if em and name in enums:
        variants = [v.strip().rstrip(",") for v in drift.strip_comments(em.group(1)).splitlines()]
        return {"name": name, "type": {"kind": "enum", "variants": [{"name": v} for v in variants if v]}}
    fields = [{"name": n, "type": drift.rust_idl_type(t)} for n, t in struct_fields_raw(src, name)]
    return {"name": name, "type": {"kind": "struct", "fields": fields}}


def upsert(items: list, entry: dict) -> str:
    for i, item in enumerate(items):
        if item["name"] == entry["name"]:
            items[i] = entry
            return "replaced"
    items.append(entry)
    return "appended"


def error_entries(src: str) -> list[dict]:
    m = re.search(r"#\[error_code\]\s*pub enum \w+\s*\{(.*?)\n\}", src, re.S)
    if not m:
        raise SystemExit("#[error_code] enum not found")
    out, code, msg = [], 6000, None
    for line in m.group(1).splitlines():
        line = line.strip()
        mm = re.match(r'#\[msg\("(.*)"\)\]', line)
        if mm:
            msg = mm.group(1).replace('\\"', '"')
            continue
        vm = re.match(r"(\w+),?$", line)
        if vm and not line.startswith("//"):
            entry = {"code": code, "name": vm.group(1)}
            if msg is not None:
                entry["msg"] = msg
            out.append(entry)
            code += 1
            msg = None
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("program", choices=sorted(drift.PROGRAMS))
    ap.add_argument("--instructions", default="")
    ap.add_argument("--types", default="")
    ap.add_argument("--accounts", default="", help="account types (discriminator + type entry)")
    ap.add_argument("--events", default="", help="event types (discriminator + type entry)")
    ap.add_argument("--remove-types", default="")
    ap.add_argument("--errors", action="store_true")
    args = ap.parse_args()

    path = drift.PROGRAMS[args.program]
    src = drift.read_sources(path)
    consts = seed_constants(src)
    enums = set(re.findall(r"pub enum (\w+)", src))
    idl_path = os.path.join(drift.COMMITTED_DIR, f"{args.program}.json")
    idl = json.load(open(idl_path, encoding="utf-8"))

    def names(value):
        return [n for n in value.split(",") if n]

    for name in names(args.instructions):
        print(f"instruction {name}: {upsert(idl['instructions'], instruction_entry(name, src, consts))}")
    for name in names(args.accounts):
        upsert(idl.setdefault("accounts", []), {"name": name, "discriminator": disc("account", name)})
        print(f"account {name}: {upsert(idl['types'], type_entry(name, src, enums))}")
    for name in names(args.events):
        upsert(idl.setdefault("events", []), {"name": name, "discriminator": disc("event", name)})
        print(f"event {name}: {upsert(idl['types'], type_entry(name, src, enums))}")
    for name in names(args.types):
        print(f"type {name}: {upsert(idl['types'], type_entry(name, src, enums))}")
    for name in names(args.remove_types):
        for key in ("types", "events", "accounts"):
            before = len(idl.get(key, []))
            idl[key] = [t for t in idl.get(key, []) if t["name"] != name]
            if len(idl[key]) != before:
                print(f"removed {key[:-1]} {name}")
    if args.errors:
        idl["errors"] = error_entries(src)
        print(f"errors: {len(idl['errors'])}")

    with open(idl_path, "w", encoding="utf-8") as f:
        json.dump(idl, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {idl_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
