'use strict';

// [RUNTIME LAMPORT RULE] At every CPI the Solana runtime re-checks the calling
// instruction's lamport sum, and it sees the caller's direct lamport edits only
// for the accounts passed to that CPI. A handler that credits or debits
// lamports directly and then makes a CPI that carries only one side of that
// move fails with UnbalancedInstruction. The Rust host tests cannot see this
// (they emulate CPIs); the local validator found it in auction settlement with
// a bid, offer acceptance and the random reroll commit. Rule enforced here:
// inside a function, no direct lamport move may come before a CPI.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const DIRECT = /\btransfer_owned_lamports\s*\(|\brelease_escrow\s*\(|\breimburse_settler\s*\(|\btry_borrow_mut_lamports\s*\(|\.(?:sub|add|set)_lamports\s*\(/g;
const CPI = /\binvoke(?:_signed)?\s*\(|CpiContext::new|system_program::transfer\s*\(|\btoken::(?:transfer|transfer_checked|burn|mint_to|close_account|approve|revoke|freeze_account|thaw_account|set_authority)\s*\(|\bvrf::(?:commit|reveal|cpi_init)\s*\(|\bmint_tool_nft\s*\(/g;

function rustFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.rs') && !/tests?\.rs$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.join(ROOT, 'aof-core', 'src'));
  for (const program of fs.readdirSync(path.join(ROOT, 'programs'))) {
    const src = path.join(ROOT, 'programs', program, 'src');
    if (fs.existsSync(src)) walk(src);
  }
  return out;
}

/** Function bodies of production code (everything before `#[cfg(test)]`). */
function functions(source) {
  const code = source.split('#[cfg(test)]')[0].replace(/\/\/[^\n]*/g, (c) => ' '.repeat(c.length));
  const found = [];
  const header = /\bfn\s+(\w+)[^{;]*\{/g;
  let m;
  while ((m = header.exec(code))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < code.length && depth > 0) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') depth -= 1;
      i += 1;
    }
    found.push({ name: m[1], start: m.index, body: code.slice(m.index + m[0].length, i) });
  }
  return found;
}

/** Violations: a direct lamport move followed by a CPI in the same function. */
function violations(source) {
  const bad = [];
  for (const fn of functions(source)) {
    const direct = [...fn.body.matchAll(DIRECT)].map((x) => x.index);
    const cpi = [...fn.body.matchAll(CPI)].map((x) => x.index);
    if (direct.length && cpi.length && Math.min(...direct) < Math.max(...cpi)) {
      bad.push({ name: fn.name, line: source.slice(0, fn.start).split('\n').length });
    }
  }
  return bad;
}

test('direct lamport moves come after every CPI of the same handler', () => {
  const bad = [];
  for (const file of rustFiles()) {
    for (const v of violations(fs.readFileSync(file, 'utf8'))) {
      bad.push(`${path.relative(ROOT, file)}:${v.line} fn ${v.name}`);
    }
  }
  assert.deepEqual(bad, [], 'move lamports directly only after the last CPI of the handler');
});

test('the checker catches the patterns that failed on the validator', () => {
  const broken = `
pub fn settle_handler(ctx: Context<X>) -> Result<()> {
    crate::economics::transfer_owned_lamports(&a, &b, 1, 0)?;
    token::transfer(CpiContext::new_with_signer(p, t, &[seeds]), 1)?;
    Ok(())
}
pub fn commit_handler(ctx: Context<Y>) -> Result<()> {
    **ctx.accounts.a.try_borrow_mut_lamports()? -= 1;
    anchor_lang::system_program::transfer(CpiContext::new(p, t), 2)?;
    Ok(())
}`;
  assert.deepEqual(violations(broken).map((v) => v.name), ['settle_handler', 'commit_handler']);
  const fixed = `
pub fn settle_handler(ctx: Context<X>) -> Result<()> {
    token::transfer(CpiContext::new_with_signer(p, t, &[seeds]), 1)?;
    // transfer_owned_lamports( in a comment does not count
    crate::economics::transfer_owned_lamports(&a, &b, 1, 0)?;
    Ok(())
}`;
  assert.deepEqual(violations(fixed), []);
});
