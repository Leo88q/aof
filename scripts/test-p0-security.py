#!/usr/bin/env python3
"""Source-level regression tripwires, NOT a substitute for Anchor/SVM tests.

For each audit rule a mutation deleting a required defense must fail the gate.
Behavioral tests live in Rust and tests/sql; evidence levels stay separate.
"""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATHS = {
    'session': 'programs/aof-session-keys/src/lib.rs',
    'market': 'programs/aof-market/src/lib.rs',
    'lp': 'programs/aof-liquidity/src/state/lp_pool.rs',
    'deposit': 'programs/aof-liquidity/src/instructions/lp_deposit.rs',
    'rebirth': 'programs/aof-rebirth/src/instructions/do_rebirth.rs',
    'drum': 'programs/aof-quests/src/instructions/drum/drum_reveal.rs',
}


def sources():
    return {k: re.sub(r'//[^\n]*', '', (ROOT / p).read_text()) for k, p in PATHS.items()}


def body(src, start):
    at = src.index('{', src.index(start))
    depth = 1
    end = at + 1
    while depth:
        depth += (src[end] == '{') - (src[end] == '}')
        end += 1
    return src[at:end]


def check(s):
    spend = body(s['session'], "pub struct SessionCheckAndSpend")
    assert "pub authority: Signer<'info>" in spend, 'SW001'
    assert 'session.authority == authority.key()' in spend, 'SW013'
    assert 'seeds = [SESSION_SEED, authority.key().as_ref()]' in spend, 'SW013'
    assert 'owner = anchor_lang::system_program::ID' in s['session'], 'SW013'
    assert 'address = drum_commit.user' in s['drum'], 'SW013'
    cancel = body(s['market'], 'pub fn cancel_limit_order')
    assert 'order_vault.reload()?' in cancel and 'maker_currency.reload()?' in cancel, 'SW008'
    assert cancel.index('order_vault.reload()?') > cancel.index('token::transfer('), 'SW008'
    assert cancel.index('maker_currency.reload()?') > cancel.index('token::transfer('), 'SW008'
    assert 'order.reload()' not in cancel, 'SW008: discards active=false'
    assert 'init, payer = authority, space = SESSION_SPACE' in s['session'], 'SW016'
    assert 'epoch >= t.computed_epoch' in s['session'], 'SW016'
    assert 'require!(false, RebirthError::FeatureDisabled)' in s['rebirth'], 'SW016'
    assert 'pool.total_shares.checked_add(shares_minted)' in s['deposit'], 'SW016'
    assert 'position.shares.checked_add(shares_minted)' in s['deposit'], 'SW016'
    assert '.checked_div(assets)' in s['lp'], 'SW024'
    assert '.checked_div(total as u128)' in s['lp'], 'SW024'
    for file, fn in [('market', 'set_fees'), ('market', 'set_paused'), ('market', 'cancel_limit_order'),
                     ('session', 'session_revoke'), ('session', 'session_pause')]:
        assert 'emit!(' in body(s[file], 'pub fn ' + fn + '('), 'SW027'
    assert 'emit!(RebirthPerformed' in s['rebirth'], 'SW027'


class SecurityTripwires(unittest.TestCase):
    def test_current_sources(self):
        check(sources())

    def test_negative_mutations_are_detected_for_every_rule(self):
        mutations = [
            ('SW001', 'session', "pub authority: Signer<'info>", "pub authority: UncheckedAccount<'info>"),
            ('SW008', 'market', 'ctx.accounts.order_vault.reload()?;', ''),
            ('SW013', 'drum', 'address = drum_commit.user', 'address = user.key()'),
            ('SW016', 'session', 'init, payer = authority, space = SESSION_SPACE', 'init_if_needed, payer = authority, space = SESSION_SPACE'),
            ('SW024', 'lp', '.checked_div(assets)', '.checked_div(1)'),
            ('SW027', 'market', 'emit!(', 'removed_event!('),
        ]
        for rule, key, old, new in mutations:
            with self.subTest(rule=rule):
                src = sources()
                self.assertIn(old, src[key])
                src[key] = src[key].replace(old, new)
                with self.assertRaises(AssertionError):
                    check(src)

    def test_persistent_accounts_have_no_reinitialization_primitive(self):
        # These retained init_if_needed accounts must never become closable,
        # system-owned or drainable. A new instruction triggers manual review.
        for program in ['aof-session-keys', 'aof-liquidity', 'aof-rebirth']:
            for p in (ROOT / 'programs' / program / 'src').rglob('*.rs'):
                text = re.sub(r'//[^\n]*', '', p.read_text())
                self.assertNotRegex(text, r'\bclose\s*=|\.realloc\(|\.assign\(|sub_lamports\(|try_borrow_mut_lamports\(')

    def test_scanner_has_no_blanket_suppression(self):
        self.assertIn('ignore = []', (ROOT / 'sentio.toml').read_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
