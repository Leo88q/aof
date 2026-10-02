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
    'orderbook': 'aof-core/src/instructions/orderbook.rs',
    'core': 'aof-core/src/lib.rs',
    'lp': 'programs/aof-liquidity/src/state/lp_pool.rs',
    'deposit': 'programs/aof-liquidity/src/instructions/lp_deposit.rs',
    'rebirth': 'programs/aof-rebirth/src/instructions/do_rebirth.rs',
    'rebirth_reset': 'aof-core/src/instructions/rebirth_reset.rs',
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
    # SW008 was originally about the retired market::cancel_limit_order path.
    # The active implementation lives in aof-core and closes its escrow vault
    # after returning every remaining token, so there is no post-CPI balance read
    # for which an Account::reload() is required.
    for marker in ('pub fn cancel_sell_handler(', 'pub fn cancel_sell_handler_v2('):
        cancel = body(s['orderbook'], marker)
        assert 'from: ctx.accounts.order_vault.to_account_info()' in cancel, 'SW008'
        assert 'to: ctx.accounts.maker_token.to_account_info()' in cancel, 'SW008'
        assert 'authority: ctx.accounts.order.to_account_info()' in cancel, 'SW008'
        assert cancel.index('token::transfer(') < cancel.index('token::close_account('), 'SW008'
        assert 'ctx.accounts.order.amount_remaining = 0;' in cancel, 'SW008'
    for marker in ("pub struct CancelSellOrder<'info>", "pub struct CancelSellOrderV2<'info>"):
        accounts = body(s['core'], marker)
        assert "pub maker: Signer<'info>" in accounts and 'close = maker' in accounts, 'SW008'
        assert 'constraint = order_vault.owner == order.key()' in accounts, 'SW008'
        assert 'constraint = maker_token.mint == mint.key()' in accounts, 'SW008'
        assert 'constraint = maker_token.owner == maker.key()' in accounts, 'SW008'
    assert 'init, payer = authority, space = SESSION_SPACE' in s['session'], 'SW016'
    assert 'epoch >= t.computed_epoch' in s['session'], 'SW016'
    # [§3.4] Перерождение больше не заглушка, но и не «бонус даром»: цена и
    # кулдаун остаются, бонус подписывает authority (без полного сброса в той же
    # транзакции его не получить), а сброс жжёт только канонические ресурсы
    # игрока и только после всех проверок.
    assert 'require!(false, RebirthError::FeatureDisabled)' not in s['rebirth'], \
        'SW016: rebirth снова замолчали заглушкой вместо атомарного сброса'
    assert 'address = rebirth_config.authority @ RebirthError::Unauthorized' in s['rebirth'], 'SW016'
    reset = s['rebirth_reset']
    assert 'get_associated_token_address(&user_key, &mint_info.key())' in reset, 'SW016: ATA'
    assert 'TokenState::unpack(&data[..])' in reset, 'SW016: token account'
    assert 'require!(amount > 0' in reset, 'SW016: zero burn'
    assert reset.index('get_associated_token_address(') < reset.index('token::burn('), 'SW016: CPI order'
    assert reset.index('require!(amount > 0') < reset.index('token::burn('), 'SW016: CPI order'
    assert 'pool.total_shares.checked_add(shares_minted)' in s['deposit'], 'SW016'
    assert 'position.shares.checked_add(shares_minted)' in s['deposit'], 'SW016'
    assert '.checked_div(assets)' in s['lp'], 'SW024'
    assert '.checked_div(total as u128)' in s['lp'], 'SW024'
    # The SW027 cancel_limit_order row is a historical finding for a retired
    # market instruction. The active core orderbook cancellation handlers still
    # lack a cancellation event; that low-severity telemetry debt needs separate
    # event/IDL work and is not closed by this source tripwire.
    for file, fn in [('market', 'set_fees'), ('market', 'set_paused'),
                     ('session', 'session_revoke'), ('session', 'session_pause')]:
        assert 'emit!(' in body(s[file], 'pub fn ' + fn + '('), 'SW027'
    assert 'emit!(RebirthPerformed' in s['rebirth'], 'SW027'


class SecurityTripwires(unittest.TestCase):
    def test_current_sources(self):
        check(sources())

    def test_negative_mutations_are_detected_for_every_rule(self):
        mutations = [
            ('SW001', 'session', "pub authority: Signer<'info>", "pub authority: UncheckedAccount<'info>"),
            ('SW008', 'orderbook', 'to: ctx.accounts.maker_token.to_account_info()', 'to: ctx.accounts.order_vault.to_account_info()'),
            ('SW013', 'drum', 'address = drum_commit.user', 'address = user.key()'),
            ('SW016', 'session', 'init, payer = authority, space = SESSION_SPACE', 'init_if_needed, payer = authority, space = SESSION_SPACE'),
            ('SW016', 'rebirth_reset', 'get_associated_token_address(&user_key, &mint_info.key())', 'mint_info.key()'),
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
