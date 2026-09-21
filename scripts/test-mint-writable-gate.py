#!/usr/bin/env python3
"""Self-test for `scripts/check-mint-writable.py`.

[AUDIT F-05] The gate used to print "OK (53 checked)" while `craft_recipe`
shipped three read-only mints (F-04): the CPIs were generated inside a
`macro_rules!`, and the gate only matched `mint: ctx.accounts.<field>` written
literally in the handler body. Macro resolution was added to the gate, but a
resolution rule that is never exercised against a known-bad fixture is just
another unverified claim — so this file pins both directions:

  * a read-only mint passed to `MintTo` directly      -> gate must FAIL
  * a read-only mint passed through `macro_rules!`    -> gate must FAIL
  * the same two with `#[account(mut)]`               -> gate must PASS
  * the repository itself                             -> gate must PASS

Run: python3 scripts/test-mint-writable-gate.py
"""
from __future__ import annotations

import pathlib
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
GATE = HERE / "check-mint-writable.py"
REPO = HERE.parent


def run_gate(program_dir: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(GATE), "--program-dir", str(program_dir)],
        capture_output=True, text=True, cwd=str(REPO),
    )


# --- fixtures ---------------------------------------------------------------
# The `mut` in the attribute is the only difference between BAD and GOOD.

def context(mut_attr: str) -> str:
    return f"""
use anchor_lang::prelude::*;
use anchor_spl::token::{{Mint, MintTo, Token, TokenAccount}};

#[derive(Accounts)]
pub struct Recipe<'info> {{
    /// CHECK: signer
    pub auth: UncheckedAccount<'info>,
    #[account({mut_attr})]
    pub output_mint: Account<'info, Mint>,
    #[account(mut)]
    pub output_acc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}}

#[derive(Accounts)]
pub struct Direct<'info> {{
    /// CHECK: signer
    pub auth: UncheckedAccount<'info>,
    #[account({mut_attr})]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}}
"""


# F-04 shape: the CPI is emitted by a macro, so `mint:` never appears literally
# in the handler body.
MACRO_HANDLER = """
macro_rules! do_mint {
    ($mint:expr, $to:expr, $auth:expr, $amount:expr) => {
        token::mint_to(
            CpiContext::new_with_signer(
                $auth.to_account_info(),
                MintTo { mint: $mint.to_account_info(), to: $to.to_account_info(), authority: $auth.to_account_info() },
                &[],
            ),
            $amount,
        )
    };
}

pub fn recipe(ctx: Context<Recipe>, amount: u64) -> Result<()> {
    do_mint!(ctx.accounts.output_mint, ctx.accounts.output_acc, ctx.accounts.auth, amount)?;
    Ok(())
}
"""

DIRECT_HANDLER = """
pub fn direct(ctx: Context<Direct>, amount: u64) -> Result<()> {
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.auth.to_account_info(),
            MintTo { mint: ctx.accounts.mint.to_account_info(), to: ctx.accounts.to.to_account_info(), authority: ctx.accounts.auth.to_account_info() },
            &[],
        ),
        amount,
    )?;
    Ok(())
}
"""


class GateSelfTest(unittest.TestCase):
    def _write(self, tmp: str, mut_attr: str) -> str:
        root = pathlib.Path(tmp)
        (root / "src").mkdir(exist_ok=True)
        (root / "src" / "lib.rs").write_text(context(mut_attr) + MACRO_HANDLER + DIRECT_HANDLER)
        return str(root)

    def test_macro_cpi_readonly_mint_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self._write(tmp, "")
            proc = run_gate(root)
            self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
            self.assertIn("Recipe.output_mint", proc.stdout)

    def test_direct_cpi_readonly_mint_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self._write(tmp, "")
            proc = run_gate(root)
            self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
            self.assertIn("Direct.mint", proc.stdout)

    def test_mut_mints_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self._write(tmp, "mut")
            proc = run_gate(root)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            self.assertIn("OK (2 mint CPI field(s) checked", proc.stdout)

    def test_repo_is_clean(self):
        proc = run_gate("aof-core")
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("all writable", proc.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
