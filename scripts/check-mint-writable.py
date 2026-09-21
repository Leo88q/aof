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

[AUDIT F-04] `craft_recipe` shipped three read-only mints anyway (all eight
recipes were dead on arrival) and this gate printed "OK (53 checked)" over it.
[AUDIT F-05] The reason: the mint_to CPIs were generated inside a
`macro_rules!`, and the gate only looked for `MintTo { mint: ... }` written
literally in the handler body. Macro-generated CPIs are now resolved: the
macro's parameter list is matched against each invocation site, and the argument
that lands in the `mint:` position is traced back to its
`ctx.accounts.<field>` (directly, or through a `let (mint, ..) in [..]` tuple
binding).

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
# macro_rules! NAME { ( $a:expr, $b:expr ) => { ... }; }
MACRO_RE = re.compile(r"macro_rules!\s*(\w+)\s*\{(.*?)\n\s*\};", re.S)
MACRO_PARAMS_RE = re.compile(r"\(\s*(.*?)\s*\)\s*=>", re.S)
MACRO_MINT_RE = re.compile(r"(?:MintTo|Burn)\s*\{[^}]*?mint:\s*\$(\w+)\.to_account_info", re.S)
INVOKE_RE = re.compile(r"\b(\w+)!\(")


def split_top_level_args(text: str) -> list[str]:
    """Split `a, b, c` into top-level arguments (respecting nesting)."""
    out, cur, depth = [], "", 0
    for ch in text:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def mint_macros(src: str) -> dict[str, list[int]]:
    """Map macro name -> indices (in its parameter list) of the `$var` used as
    the `mint:` field of a MintTo/Burn literal inside the macro body."""
    out: dict[str, list[int]] = {}
    for m in MACRO_RE.finditer(src):
        name, body = m.group(1), m.group(2)
        pm = MACRO_PARAMS_RE.search(body)
        if not pm:
            continue
        params = [p.strip().lstrip("$").split(":")[0] for p in split_top_level_args(pm.group(1))]
        indices = []
        for used in MACRO_MINT_RE.findall(body):
            if used in params:
                indices.append(params.index(used))
        # `mint:` may also be reached through a `$var` used in `Burn { mint: $mint ... }`
        if indices:
            out[name] = indices
    return out


def mint_field_attr(struct_body: str, field: str):
    """Return the attribute/comment block above `pub <field>: ...Mint>` or None
    if the field is not a Mint account (e.g. UncheckedAccount)."""
    m = re.search(
        r"((?:#\[account(?:\([^\]]*?\))?\]\s*|///[^\n]*\n\s*|//[^\n]*\n\s*)*)pub "
        + re.escape(field)
        + r"\s*:\s*(?:Box<)?(?:Account|InterfaceAccount)<'info,\s*(?:token::)?Mint>",
        struct_body, re.S)
    return m.group(1) if m else None


def resolve_arg(arg: str, body: str) -> set[str]:
    """Resolve one invocation argument to the ctx.accounts field(s) it names."""
    fields: set[str] = set()
    m = re.fullmatch(r"&?\*?ctx\.accounts\.(\w+)", arg)
    if m:
        fields.add(m.group(1))
        return fields
    m = re.fullmatch(r"(\w+)", arg)
    if m and m.group(1) != "ctx":
        # Local binding: either `let x = &ctx.accounts.<f>;` or a tuple list.
        local = re.search(r"let\s+" + m.group(1) + r"\s*=\s*&?\*?ctx\.accounts\.(\w+)", body)
        if local:
            fields.add(local.group(1))
        else:
            fields |= set(TUPLE_RE.findall(body))
    return fields


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
        macros = mint_macros(src)
        interesting = ("MintTo" in src or "Burn" in src or "execute_mint(" in src or macros)
        if not interesting:
            continue
        for hm in HANDLER_RE.finditer(src):
            fn, ctx_name, body = hm.group(1), hm.group(2), hm.group(0)
            fields = set(CPI_DIRECT_RE.findall(body))
            # Shared resource mint implementation takes accounts by reference;
            # follow its two known context callers rather than silently losing
            # these CPIs from the gate when the handler is factored out.
            if "execute_mint(" in body:
                if ctx_name not in {"MintResource", "MintResourceOnce"}:
                    violations.append(f"{path}: review new execute_mint caller {ctx_name}")
                fields.add("mint")
            if any(v != "ctx" for v in CPI_BOUND_RE.findall(body)):
                fields |= set(TUPLE_RE.findall(body))
            # [AUDIT F-05] resolve macro-generated CPIs at each invocation site.
            for im in INVOKE_RE.finditer(body):
                name = im.group(1)
                if name not in macros:
                    continue
                i = im.end()
                depth, j = 1, i
                while j < len(body) and depth:
                    if body[j] in "([{":
                        depth += 1
                    elif body[j] in ")]}":
                        depth -= 1
                    j += 1
                call_args = split_top_level_args(body[i:j - 1])
                for idx in macros[name]:
                    if idx < len(call_args):
                        fields |= resolve_arg(call_args[idx], body)
            if not fields:
                continue
            struct_body = structs.get(ctx_name)
            if struct_body is None:
                print(f"::warning::{path}: {fn}: context struct {ctx_name} not found")
                continue
            for field in sorted(fields):
                attr = mint_field_attr(struct_body, field)
                if attr is None:
                    if "execute_mint(" in body:
                        violations.append(f"{path}: shared resource mint field missing in {ctx_name}")
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
