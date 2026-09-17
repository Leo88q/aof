#!/usr/bin/env python3
"""Fail if an Anchor account context passes a read-only Mint to a token
mint_to / burn CPI.

SPL Token changes the mint supply on mint_to and burn, so the mint account must
be writable. Anchor only marks an account writable when its field carries
`mut`; a read-only mint compiles fine and fails only on a real validator with
"Cross-program invocation with unauthorized signer or writable account /
writable privilege escalated". That is exactly how plant_seeds, start_milling,
start_baking, harvest_wheat, exploration, forge, referral upgrades, season
rewards and use_flask were broken before e2964cd / 16aeba1.

The check is a static approximation: for every `pub fn <name>(ctx: Context<X>`
handler in the program's instruction files it collects the mint fields used in
MintTo { mint: ... } / Burn { mint: ... } literals (directly as
`ctx.accounts.<field>` or via a local binding populated from a tuple list of
`(&ctx.accounts.<field>, ...)`) and requires the matching field in struct X to
have `mut` in its #[account(...)] attribute.

Usage: scripts/check-mint-writable.py [--program-dir aof-core]
Exit code 0 = clean, 1 = violations, 2 = usage error.
"""
from __future__ import annotations
import argparse, glob, os, re, sys

STRUCT_RE = re.compile(r"pub struct (\w+)<'info>\s*\{.*?\n\}", re.S)
HANDLER_RE = re.compile(r"pub fn (\w+)\s*\(\s*ctx:\s*Context<(\w+)>.*?(?=\npub fn |\Z)", re.S)
CPI_DIRECT_RE = re.compile(r"(?:MintTo|Burn)\s*\{[^}]*?mint:\s*ctx\.accounts\.(\w+)\.to_account_info", re.S)
CPI_BOUND_RE = re.compile(r"(?:MintTo|Burn)\s*\{[^}]*?mint:\s*(\w+)\.to_account_info", re.S)
TUPLE_RE = re.compile(r"\(\s*&\*?ctx\.accounts\.(\w+)\s*,")


def mint_field_attr(struct_body: str, field: str):
    """Return the attribute/comment block above `pub <field>: ...Mint>` or None
    if the field is not a Mint account (e.g. UncheckedAccount)."""
    m = re.search(
        r"((?:#\[account(?:\([^\]]*?\))?\]\s*|///[^\n]*\n\s*|//[^\n]*\n\s*)*)pub "
        + re.escape(field)
        + r"\s*:\s*(?:Box<)?(?:Account|InterfaceAccount)<'info,\s*(?:token::)?Mint>",
        struct_body, re.S)
    return m.group(1) if m else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--program-dir", default="aof-core")
    args = ap.parse_args()
    src_dir = os.path.join(args.program_dir, "src")
    if not os.path.isdir(src_dir):
        print(f"no such dir: {src_dir}", file=sys.stderr); return 2

    structs: dict[str, str] = {}
    for path in glob.glob(os.path.join(src_dir, "**", "*.rs"), recursive=True):
        if ".bak" in path:
            continue
        for m in STRUCT_RE.finditer(open(path, encoding="utf-8").read()):
            structs.setdefault(m.group(1), m.group(0))

    violations, checked = [], 0
    for path in sorted(glob.glob(os.path.join(src_dir, "**", "*.rs"), recursive=True)):
        if ".bak" in path:
            continue
        src = open(path, encoding="utf-8").read()
        if "MintTo" not in src and "Burn" not in src:
            continue
        for hm in HANDLER_RE.finditer(src):
            fn, ctx_name, body = hm.group(1), hm.group(2), hm.group(0)
            if "MintTo {" not in body and "Burn {" not in body:
                continue
            fields = set(CPI_DIRECT_RE.findall(body))
            if any(v != "ctx" for v in CPI_BOUND_RE.findall(body)):
                fields |= set(TUPLE_RE.findall(body))
            struct_body = structs.get(ctx_name)
            if struct_body is None:
                print(f"::warning::{path}: {fn}: context struct {ctx_name} not found")
                continue
            for field in sorted(fields):
                attr = mint_field_attr(struct_body, field)
                if attr is None:
                    continue
                checked += 1
                # Only the #[account(...)] attributes count; doc/line comments
                # above the field may legitimately mention the word `mut`.
                attrs = " ".join(re.findall(r"#\[account\(([^\]]*?)\)\]", attr, re.S))
                if not re.search(r"(^|[\s,(])mut([\s,)]|$)", attrs):
                    violations.append(f"{os.path.relpath(path)}: {fn} ({ctx_name}.{field}) - Mint used in mint_to/burn is not `mut`")

    for v in violations:
        print(f"::error::{v}")
    if violations:
        print(f"mint-writable check: {len(violations)} violation(s), {checked} mint CPI field(s) checked")
        return 1
    print(f"mint-writable check: OK ({checked} mint CPI field(s) checked, all writable)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
