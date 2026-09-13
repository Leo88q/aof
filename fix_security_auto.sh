#!/bin/bash
set -e

CORE="/Users/zlata/Desktop/aof_gui/aof-core"
MARKET="/Users/zlata/Desktop/aof_gui/programs/aof-market"
QUESTS="/Users/zlata/Desktop/aof_gui/programs/aof-quests"
SESSION="/Users/zlata/Desktop/aof_gui/programs/aof-session-keys"

echo "🔒 Автоматическое исправление 5 дыр безопасности"
echo "================================================"

# ---------- БЭКАПЫ ----------
for f in \
  "$CORE/src/instructions/orderbook.rs" \
  "$CORE/src/instructions/repair.rs" \
  "$CORE/src/instructions/auction.rs" \
  "$CORE/src/lib.rs" \
  ; do
  [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"
done
# Для расширения ищем файлы динамически
for dir in "$MARKET" "$QUESTS" "$SESSION" /Users/zlata/Desktop/aof_gui/aof_expansion/programs/*; do
  [ -d "$dir" ] || continue
  find "$dir/src" -type f \( -name "buy.rs" -o -name "trust_snapshot_update.rs" -o -name "lib.rs" \) \
    -exec cp {} {}.bak.$(date +%s) \; 2>/dev/null || true
done
echo "✅ Бэкапы созданы"

# ---------- Python-патчер ----------
cat > /tmp/fix_security.py << 'PYEOF'
import re, sys, glob, os

CORE = "/Users/zlata/Desktop/aof_gui/aof-core"
EXP  = "/Users/zlata/Desktop/aof_gui/aof_expansion/programs"

def patch(path, patterns):
    """patterns: list of (regex, replacement)."""
    if not os.path.exists(path):
        print(f"  ⚠ файл не найден: {path}")
        return False
    with open(path) as f:
        src = f.read()
    orig = src
    for pat, repl in patterns:
        new = re.sub(pat, repl, src, flags=re.DOTALL | re.MULTILINE)
        if new == src:
            print(f"  ⚠ паттерн не сработал в {os.path.basename(path)}: {pat[:60]}...")
        src = new
    if src == orig:
        print(f"  ⚠ ничего не изменилось в {path}")
        return False
    with open(path, "w") as f:
        f.write(src)
    print(f"  ✅ {path}")
    return True

changes = 0

# =============================================================
# ПРОБЛЕМА #3 — Orderbook: buy_order не привязан к mint
# =============================================================
print("\n📌 Проблема #3: Orderbook SOL theft")
orderbook = os.path.join(CORE, "src/instructions/orderbook.rs")
# Ищем buy_order в MatchResourceOrders и добавляем constraint+seeds
patterns_3 = [
    # вариант A: buy_order без seeds/constraint (одна строка)
    (
        r'(pub\s+buy_order:\s*Account<\'info,\s*ResourceOrder>)',
        r'// [AUDIT FIX #3] buy_order привязан к mint\n    pub buy_order: Account<\'info, ResourceOrder>',
    ),
]
# Точечная замена атрибута #[account(mut)] перед buy_order
with open(orderbook) as f:
    src = f.read()

# Ищем блок buy_order и меняем его атрибут
m = re.search(
    r'(#\[account\([^)]*\)\]\s*\n\s*pub\s+buy_order:\s*Account<\'info,\s*ResourceOrder>)',
    src, re.DOTALL
)
if m:
    old = m.group(1)
    new = (
        '#[account(\n'
        '        mut,\n'
        '        seeds = [RESOURCE_ORDER_SEED, buy_order.maker.as_ref(), mint.key().as_ref()],\n'
        '        bump,\n'
        '        constraint = buy_order.mint == mint.key() @ AofError::InvalidMint\n'
        '    )]\n'
        '    pub buy_order: Account<\'info, ResourceOrder>'
    )
    src = src.replace(old, new, 1)
    with open(orderbook, "w") as f:
        f.write(src)
    print(f"  ✅ {orderbook}")
    changes += 1
else:
    # fallback — ищем более свободно
    new_src = re.sub(
        r'(pub\s+buy_order:\s*Account<\'info,\s*ResourceOrder>)',
        r'// [AUDIT #3] добавь constraint = buy_order.mint == mint.key() и seeds с mint\n    \1',
        src, count=1
    )
    if new_src != src:
        with open(orderbook, "w") as f:
            f.write(new_src)
        print(f"  ⚠ {orderbook}: поставлен TODO-комментарий, проверь вручную")
        changes += 1

# =============================================================
# ПРОБЛЕМА #4 — Hot-market: treasury_mascot без address
# =============================================================
print("\n📌 Проблема #4: Hot-market free buy")
buy_candidates = glob.glob(os.path.join(EXP, "aof-market/src/**/buy.rs"), recursive=True) \
               + glob.glob(os.path.join(EXP, "aof-market/src/instructions/hot_market*.rs"), recursive=True) \
               + glob.glob(os.path.join("/Users/zlata/Desktop/aof_gui/programs/aof-market/src/**/*.rs"), recursive=True)
buy_candidates = list(set(buy_candidates))
found_4 = False
for path in buy_candidates:
    with open(path) as f:
        s = f.read()
    if "treasury_mascot" in s and "HotMarketBuy" in s:
        # Меняем UncheckedAccount → Account<TokenAccount> с address
        new_s = re.sub(
            r'(///\s*CHECK:[^\n]*\n\s*)?#\[account\(mut\)\]\s*\n\s*pub\s+treasury_mascot:\s*UncheckedAccount<\'info>',
            '#[account(mut, address = mascot_config.treasury_mascot)]\n    pub treasury_mascot: Account<\'info, TokenAccount>',
            s
        )
        # Если не нашлось — пробуем без CHECK
        if new_s == s:
            new_s = re.sub(
                r'#\[account\(mut\)\]\s*\n\s*pub\s+treasury_mascot:\s*UncheckedAccount<\'info>',
                '#[account(mut, address = mascot_config.treasury_mascot)]\n    pub treasury_mascot: Account<\'info, TokenAccount>',
                s
            )
        if new_s != s:
            # добавить импорт TokenAccount если нет
            if "use anchor_spl::token" in new_s and "TokenAccount" not in new_s:
                new_s = new_s.replace(
                    "use anchor_spl::token::{self, Token",
                    "use anchor_spl::token::{self, Token, TokenAccount"
                )
            with open(path, "w") as f:
                f.write(new_s)
            print(f"  ✅ {path}")
            changes += 1
            found_4 = True
if not found_4:
    print("  ⚠ файл hot-market buy не найден — возможно, ещё не создан")

# =============================================================
# ПРОБЛЕМА #5 — Repair: wood_mint без address
# =============================================================
print("\n📌 Проблема #5: Repair fake wood")
repair = os.path.join(CORE, "src/instructions/repair.rs")
if os.path.exists(repair):
    with open(repair) as f:
        s = f.read()
    # wood_mint: Account<'info, Mint> — добавляем constraint
    new_s = re.sub(
        r'(pub\s+wood_mint:\s*Account<\'info,\s*Mint>)',
        r'// [AUDIT FIX #5]\n    #[account(address = config.wood_mint)]\n    \1',
        s, count=1
    )
    # user_wood — добавляем constraint mint+owner
    new_s = re.sub(
        r'(pub\s+user_wood:\s*Account<\'info,\s*TokenAccount>)',
        r'// [AUDIT FIX #5]\n    #[account(constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]\n    \1',
        new_s, count=1
    )
    if new_s != s:
        with open(repair, "w") as f:
            f.write(new_s)
        print(f"  ✅ {repair}")
        changes += 1
    else:
        print(f"  ⚠ паттерн не найден в {repair}")
else:
    print(f"  ⚠ {repair} не существует")

# =============================================================
# ПРОБЛЕМА #7 — Trust tier self-assignment
# =============================================================
print("\n📌 Проблема #7: Trust oracle authority check")
trust_candidates = (
    glob.glob(os.path.join(EXP, "aof-session-keys/src/**/*.rs"), recursive=True) +
    glob.glob(os.path.join(EXP, "aof-market/src/**/trust*.rs"), recursive=True) +
    glob.glob(os.path.join("/Users/zlata/Desktop/aof_gui/programs/aof-market/src/**/*.rs"), recursive=True) +
    glob.glob(os.path.join("/Users/zlata/Desktop/aof_gui/programs/aof-session-keys/src/**/*.rs"), recursive=True)
)
trust_candidates = list(set(trust_candidates))
found_7 = False
for path in trust_candidates:
    with open(path) as f:
        s = f.read()
    # Ищем TrustSnapshotUpdate с oracle_authority без проверки
    if "TrustSnapshotUpdate" in s or "trust_snapshot_update" in s:
        # Добавляем config + constraint
        if "has_one = oracle_authority" not in s and "mascot_config.authority" not in s and "config.authority" not in s:
            new_s = re.sub(
                r'(pub\s+oracle_authority:\s*Signer<\'info>)',
                r'#[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = oracle_authority @ SkError::Unauthorized)]\n    pub config: Account<\'info, SkConfig>,\n    \1',
                s, count=1
            )
            if new_s != s:
                with open(path, "w") as f:
                    f.write(new_s)
                print(f"  ✅ {path}")
                changes += 1
                found_7 = True
                break
if not found_7:
    print("  ⚠ TrustSnapshotUpdate не найден или уже защищён")

# =============================================================
# ПРОБЛЕМА #9 — Auction: previous_bidder без mut
# =============================================================
print("\n📌 Проблема #9: Auction second bid")
auction = os.path.join(CORE, "src/instructions/auction.rs")
if os.path.exists(auction):
    with open(auction) as f:
        s = f.read()
    # Ищем previous_bidder и добавляем mut + address
    new_s = re.sub(
        r'(pub\s+previous_bidder:\s*(?:AccountInfo|Account)<\'info[^>]*>)',
        r'// [AUDIT FIX #9]\n    #[account(mut, address = auction.current_bidder)]\n    \1',
        s, count=1
    )
    if new_s != s:
        with open(auction, "w") as f:
            f.write(new_s)
        print(f"  ✅ {auction}")
        changes += 1
    else:
        print(f"  ⚠ паттерн не найден в {auction}")
else:
    print(f"  ⚠ {auction} не существует")

print(f"\n📊 Всего применено патчей: {changes}")
PYEOF

python3 /tmp/fix_security.py

echo ""
echo "================================================"
echo "✅ ЭТАП 1.3 ЗАВЕРШЁН"
echo "================================================"
echo ""
echo "Все бэкапы лежат рядом с оригиналами (*.bak.*)"
echo "Если что-то сломалось — восстановите из бэкапа."
echo ""
echo "⚠ Если паттерны не сработали (⚠ в выводе) —"
echo "   нужно будет отредактировать файл вручную."
