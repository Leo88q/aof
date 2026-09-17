#!/usr/bin/env python3
"""
IDL drift gate: compares the Rust account contexts of every Anchor program with
the committed IDL copies the clients actually load.

Why this exists: the Anchor IDL builder is upstream-blocked on the pinned
toolchain (anchor-lang 0.30.1 needs proc_macro2::Span::source_file), so CI
cannot regenerate target/idl/*.json and the backend/tests run against the
committed copies in aof_backend/src/idl/. Those copies drift silently - e.g.
auction_bid.previous_bidder gained `mut` in 5e0c16c but the IDL kept it
read-only, so every real bid failed with ConstraintMut (2000).

Checks, per program:
  * declare_id!() == IDL address == Anchor.toml [programs.localnet/devnet]
  * instruction set (names) is identical
  * argument count per instruction is identical
  * account list per instruction: same names, same order, same writable /
    signer / optional flags
  * aof_core.json and aof_core.ts (camelCase type helper) agree with each other

Exit code 1 on any drift. Run from the repository root:
    python3 scripts/check-idl-drift.py [--target-idl target/idl]
When --target-idl points at a directory with freshly generated IDLs they are
checked too, so the gate is meaningful whether or not the IDL builder worked.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

PROGRAMS = {
    "aof_core": "aof-core",
    "aof_market": "programs/aof-market",
    "aof_quests": "programs/aof-quests",
    "aof_rebirth": "programs/aof-rebirth",
    "aof_liquidity": "programs/aof-liquidity",
    "aof_session_keys": "programs/aof-session-keys",
}
COMMITTED_DIR = "aof_backend/src/idl"



def account_attrs(region: str) -> str:
    """Return the concatenated bodies of every `#[account(...)]` in `region`,
    matching parentheses by depth (constraints nest arbitrarily deep, e.g.
    `COption::Some(auth.key())`)."""
    out = []
    i = 0
    while True:
        j = region.find("#[account(", i)
        if j < 0:
            break
        k = j + len("#[account(")
        depth = 1
        while k < len(region) and depth:
            if region[k] == "(":
                depth += 1
            elif region[k] == ")":
                depth -= 1
            k += 1
        out.append(region[j + len("#[account("):k - 1])
        i = k
    return " ".join(out)


def read_sources(path: str) -> str:
    files = [f for f in glob.glob(os.path.join(path, "src", "**", "*.rs"), recursive=True)
             if ".bak" not in f and "src.bak" not in f]
    return "\n".join(open(f, encoding="utf-8").read() for f in sorted(files))


def strip_comments(src: str) -> str:
    return re.sub(r"//[^\n]*", "", src)


def parse_structs(src: str) -> dict[str, list[tuple[str, bool, bool, bool]]]:
    """Return {StructName: [(field, writable, signer, optional), ...]}."""
    out: dict[str, list[tuple[str, bool, bool, bool]]] = {}
    pattern = re.compile(
        r"#\[derive\(Accounts\)\](?:\s*#\[instruction\(.*?\)\])?\s*pub struct (\w+)<'info>\s*\{(.*?)\n\}",
        re.S,
    )
    for m in pattern.finditer(src):
        name, body = m.group(1), strip_comments(m.group(2))
        fields: list[tuple[str, bool, bool, bool]] = []
        prev = 0
        for f in re.finditer(r"pub (\w+):\s*([^,\n]+),", body):
            attr_region = body[prev:f.start()]
            prev = f.end()
            attrs = account_attrs(attr_region)
            # Anchor marks an account writable when it carries `mut`, or is
            # created/closed by this instruction.
            writable = bool(re.search(r"\bmut\b", attrs)) or bool(
                re.search(r"\binit(_if_needed)?\b|\bclose\b|\brealloc\b", attrs))
            ty = f.group(2).strip()
            signer = "Signer<" in ty
            optional = ty.startswith("Option<")
            fields.append((f.group(1), writable, signer, optional))
        out[name] = fields
    return out


def parse_instructions(src: str) -> dict[str, tuple[str, int]]:
    """Return {fn_name: (CtxStruct, arg_count)} for #[program] entrypoints."""
    prog = re.search(r"#\[program\]\s*pub mod \w+\s*\{(.*)\n\}", src, re.S)
    body = prog.group(1) if prog else src
    body = strip_comments(body)
    out: dict[str, tuple[str, int]] = {}
    for m in re.finditer(r"pub fn (\w+)\s*(?:<[^>]*>)?\s*\(\s*ctx:\s*Context<(\w+)>\s*(.*?)\)\s*->", body, re.S):
        rest = m.group(3).strip()
        n_args = 0
        if rest:
            # strip leading comma and count top-level commas
            rest = rest.lstrip(",").strip()
            depth = 0
            if rest:
                n_args = 1
                for ch in rest:
                    if ch in "<([":
                        depth += 1
                    elif ch in ">)]":
                        depth -= 1
                    elif ch == "," and depth == 0:
                        n_args += 1
                if rest.endswith(","):
                    n_args -= 1
        out[m.group(1)] = (m.group(2), n_args)
    return out


def idl_accounts(ix: dict) -> list[tuple[str, bool, bool, bool]]:
    return [(a["name"], bool(a.get("writable")), bool(a.get("signer")), bool(a.get("optional")))
            for a in ix.get("accounts", [])]


def camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def anchor_toml_ids() -> dict[str, dict[str, str]]:
    cfg = open("Anchor.toml", encoding="utf-8").read()
    res: dict[str, dict[str, str]] = {}
    for sec in ("localnet", "devnet"):
        m = re.search(rf"^\[programs\.{sec}\](.*?)(?=^\[|\Z)", cfg, re.M | re.S)
        res[sec] = dict(re.findall(r'^\s*(\w+)\s*=\s*"([^"]+)"', m.group(1), re.M)) if m else {}
    return res


def compare(name: str, src_ix: dict, structs: dict, idl: dict, label: str, problems: list[str]) -> None:
    idl_ix = {i["name"]: i for i in idl.get("instructions", [])}
    for fn in sorted(set(src_ix) - set(idl_ix)):
        problems.append(f"{label}: instruction `{fn}` exists in source but not in IDL")
    for fn in sorted(set(idl_ix) - set(src_ix)):
        problems.append(f"{label}: instruction `{fn}` exists in IDL but not in source")
    for fn in sorted(set(src_ix) & set(idl_ix)):
        ctx, n_args = src_ix[fn]
        if n_args != len(idl_ix[fn].get("args", [])):
            problems.append(f"{label}: `{fn}` has {n_args} args in source, {len(idl_ix[fn]['args'])} in IDL")
        s = structs.get(ctx)
        if s is None:
            problems.append(f"{label}: could not parse account struct `{ctx}` for `{fn}`")
            continue
        i = idl_accounts(idl_ix[fn])
        if [x[0] for x in s] != [x[0] for x in i]:
            problems.append(f"{label}: `{fn}` account list differs\n"
                            f"      source: {[x[0] for x in s]}\n      idl:    {[x[0] for x in i]}")
            continue
        for a, b in zip(s, i):
            if a != b:
                problems.append(
                    f"{label}: `{fn}.{a[0]}` flags differ - source writable={a[1]} signer={a[2]} optional={a[3]}; "
                    f"IDL writable={b[1]} signer={b[2]} optional={b[3]}")


def check_ts_copy(json_idl: dict, problems: list[str]) -> None:
    path = os.path.join(COMMITTED_DIR, "aof_core.ts")
    if not os.path.exists(path):
        return
    txt = open(path, encoding="utf-8").read()
    m = re.search(r"export type \w+ = (\{.*?\n\});", txt, re.S)
    if not m:
        problems.append(f"{path}: could not locate the IDL object literal")
        return
    try:
        ts = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        problems.append(f"{path}: IDL literal is not JSON-parsable ({e})")
        return
    if ts.get("address") != json_idl.get("address"):
        problems.append(f"{path}: address {ts.get('address')} != aof_core.json {json_idl.get('address')}")
    ts_ix = {i["name"]: i for i in ts.get("instructions", [])}
    for ix in json_idl.get("instructions", []):
        t = ts_ix.get(camel(ix["name"]))
        if t is None:
            problems.append(f"{path}: instruction `{camel(ix['name'])}` missing")
            continue
        a = [(camel(x[0]),) + x[1:] for x in idl_accounts(ix)]
        b = idl_accounts(t)
        if a != b:
            problems.append(f"{path}: `{camel(ix['name'])}` accounts/flags differ from aof_core.json")
        if ix.get("discriminator") != t.get("discriminator"):
            problems.append(f"{path}: `{camel(ix['name'])}` discriminator differs from aof_core.json")
        if len(ix.get("args", [])) != len(t.get("args", [])):
            problems.append(f"{path}: `{camel(ix['name'])}` arg count differs from aof_core.json")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-idl", default="target/idl", help="directory with generated IDLs (optional)")
    ap.add_argument("--ids-from-git", metavar="REV", default=None,
                    help="compare program ids against declare_id!/Anchor.toml at this git revision instead of the "
                         "working tree (CI rewrites declare_id! to throwaway keypairs before building; the committed "
                         "ids are the canonical ones)")
    args = ap.parse_args()
    git_ids: dict[str, str] | None = None
    git_toml: dict[str, dict[str, str]] | None = None
    if args.ids_from_git:
        import subprocess
        git_ids = {}
        for name, path in PROGRAMS.items():
            lib = subprocess.run(["git", "show", f"{args.ids_from_git}:{path}/src/lib.rs"],
                                 capture_output=True, text=True, check=True).stdout
            m = re.search(r'declare_id!\("([^"]+)"\)', lib)
            if m:
                git_ids[name] = m.group(1)
        cfg = subprocess.run(["git", "show", f"{args.ids_from_git}:Anchor.toml"],
                             capture_output=True, text=True, check=True).stdout
        git_toml = {}
        for sec in ("localnet", "devnet"):
            m = re.search(rf"^\[programs\.{sec}\](.*?)(?=^\[|\Z)", cfg, re.M | re.S)
            git_toml[sec] = dict(re.findall(r'^\s*(\w+)\s*=\s*"([^"]+)"', m.group(1), re.M)) if m else {}
        print(f"program ids taken from git revision {args.ids_from_git}")

    problems: list[str] = []
    toml_ids = git_toml if git_toml is not None else anchor_toml_ids()
    checked = 0
    for name, path in PROGRAMS.items():
        if not os.path.isdir(path):
            problems.append(f"{name}: program directory {path} not found")
            continue
        src = read_sources(path)
        did = re.search(r'declare_id!\("([^"]+)"\)', src)
        if not did:
            problems.append(f"{name}: declare_id! not found")
            continue
        declared = git_ids.get(name, did.group(1)) if git_ids is not None else did.group(1)
        for sec in ("localnet", "devnet"):
            if toml_ids[sec].get(name) != declared:
                problems.append(f"{name}: Anchor.toml [programs.{sec}] = {toml_ids[sec].get(name)} != declare_id {declared}")
        structs = parse_structs(src)
        src_ix = parse_instructions(src)
        copies = [(os.path.join(COMMITTED_DIR, f"{name}.json"), "committed")]
        gen = os.path.join(args.target_idl, f"{name}.json")
        if os.path.exists(gen):
            copies.append((gen, "generated"))
        for p, kind in copies:
            if not os.path.exists(p):
                problems.append(f"{name}: {kind} IDL {p} missing")
                continue
            idl = json.load(open(p, encoding="utf-8"))
            addr = idl.get("address") or (idl.get("metadata") or {}).get("address")
            if kind == "committed" and addr != declared:
                problems.append(f"{name}: {p} address {addr} != declare_id {declared}")
            compare(name, src_ix, structs, idl, f"{name} ({kind} {p})", problems)
            checked += 1
            if name == "aof_core" and kind == "committed":
                check_ts_copy(idl, problems)
        print(f"[checked] {name}: {len(src_ix)} instructions, {len(copies)} IDL copy/copies, id {declared}")

    if problems:
        print(f"\nIDL drift: {len(problems)} problem(s)")
        for p in problems:
            print("  - " + p)
        return 1
    print(f"\nIDL drift: none ({checked} IDL files match their Rust account contexts)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
