#!/bin/bash
set -e

cd /Users/zlata/Desktop/aof_gui

echo "🔨 Полноценная реализация 4 инструкций"
echo "======================================"

# Бэкапы
cp aof-core/src/state.rs aof-core/src/state.rs.bak.v2.$(date +%s)
cp aof-core/src/constants.rs aof-core/src/constants.rs.bak.v2.$(date +%s)
cp aof-core/src/errors.rs aof-core/src/errors.rs.bak.v2.$(date +%s)
cp aof-core/src/lib.rs aof-core/src/lib.rs.bak.v2.$(date +%s)
echo "✅ Бэкапы созданы"

# ============================================================
# ШАГ 1: Добавляем константы BOW_COMMIT_SEED и SKIN_SEED
# ============================================================
echo ""
echo "📝 Шаг 1: Добавляем константы..."

if ! grep -q "BOW_COMMIT_SEED" aof-core/src/constants.rs; then
    cat >> aof-core/src/constants.rs << 'CONST_EOF'

// ===== [НОВОЕ] Инструкции #11 из аудита =====
pub const BOW_COMMIT_SEED: &[u8] = b"bow_commit";
pub const SKIN_SEED: &[u8] = b"skin";

// Конверсия FOOD → энергия (1 FOOD = 10 энергии, максимум 100)
pub const FOOD_TO_ENERGY_RATE: u64 = 10;
pub const MAX_ENERGY: u32 = 100;

// Эффекты фляг (энергия за тип)
pub const FLASK_BLUE_ENERGY: u32 = 30;
pub const FLASK_YELLOW_ENERGY: u32 = 50;
CONST_EOF
    echo "✅ Константы добавлены"
else
    echo "⚠️  Константы уже есть"
fi

# ============================================================
# ШАГ 2: Добавляем ошибки
# ============================================================
echo ""
echo "📝 Шаг 2: Добавляем ошибки..."

python3 << 'PYEOF'
path = "aof-core/src/errors.rs"
with open(path) as f:
    content = f.read()

new_errors = '''
    #[msg("Invalid reveal: hash mismatch")]
    InvalidReveal,
    #[msg("Commit already revealed")]
    AlreadyRevealed,
    #[msg("Invalid flask type")]
    InvalidFlaskType,
    #[msg("Energy cap exceeded")]
    EnergyCapExceeded,
'''

# Ищем закрывающую } последнего варианта ошибки и вставляем перед ней
# Простой подход: ищем последнюю строку с "#[msg(" и добавляем после её блока
import re

if "InvalidReveal" not in content:
    # Находим последнее объявление ошибки и добавляем после него
    pattern = r'(    #\[msg\("[^"]+"\)\]\n    \w+,\n)(\n?\})'
    replacement = r'\1' + new_errors + r'\2'
    new_content = re.sub(pattern, replacement, content, count=1)
    
    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        print("✅ Ошибки добавлены")
    else:
        print("⚠️  Не удалось найти место для вставки ошибок")
        print("   Добавьте вручную: InvalidReveal, AlreadyRevealed, InvalidFlaskType")
else:
    print("⚠️  Ошибки уже есть")
PYEOF

# ============================================================
# ШАГ 3: Добавляем структуры BowCommit и Skin в state.rs
# ============================================================
echo ""
echo "📝 Шаг 3: Добавляем структуры в state.rs..."

python3 << 'PYEOF'
path = "aof-core/src/state.rs"
with open(path) as f:
    content = f.read()

new_structs = '''

// ===== [НОВОЕ] Инструкции #11 из аудита =====

/// PDA для commit-reveal награды из лука (форж)
#[account]
#[derive(InitSpace)]
pub struct BowCommit {
    pub user: Pubkey,          // 32
    pub tool_mint: Pubkey,     // 32 — к какому луку привязан
    pub hash: [u8; 32],        // 32 — SHA-256 от secret
    pub timestamp: i64,        // 8
    pub revealed: bool,        // 1
}

/// PDA для скина лука (награда за форж)
#[account]
#[derive(InitSpace)]
pub struct Skin {
    pub bow_mint: Pubkey,      // 32 — к какому луку применён
    pub skin_id: u8,           // 1 — идентификатор скина
    pub applied_at: i64,       // 8
}
'''

if "pub struct BowCommit" not in content:
    content += new_structs
    with open(path, 'w') as f:
        f.write(content)
    print("✅ BowCommit и Skin добавлены в state.rs")
else:
    print("⚠️  Структуры уже есть")
PYEOF

# ============================================================
# ШАГ 4: Добавляем 4 инструкции в lib.rs
# ============================================================
echo ""
echo "📝 Шаг 4: Добавляем инструкции в lib.rs..."

python3 << 'PYEOF'
path = "aof-core/src/lib.rs"
with open(path) as f:
    content = f.read()

# Проверяем, не добавлены ли уже
if "pub fn bow_reward_commit" in content:
    print("⚠️  Инструкции уже есть — пропускаем")
    exit(0)

# Accounts-структуры для новых инструкций
new_accounts = '''

// ===== [НОВОЕ] Accounts для инструкций #11 из аудита =====

#[derive(Accounts)]
pub struct BowRewardCommit<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [TOOL_SEED, tool_mint.key().as_ref()], bump, constraint = tool.owner == user.key() @ AofError::Unauthorized)]
    pub tool: Box<Account<'info, ToolData>>,
    pub tool_mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + BowCommit::INIT_SPACE,
        seeds = [BOW_COMMIT_SEED, tool_mint.key().as_ref()],
        bump
    )]
    pub bow_commit: Box<Account<'info, BowCommit>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BowRewardReveal<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: админ для минтинга скина
    #[account(mut, address = config.authority)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [BOW_COMMIT_SEED, bow_commit.tool_mint.as_ref()],
        bump,
        constraint = !bow_commit.revealed @ AofError::AlreadyRevealed
    )]
    pub bow_commit: Box<Account<'info, BowCommit>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: минт скина, проверяется через skin
    #[account(mut)]
    pub skin_mint: Box<Account<'info, Mint>>,
    /// CHECK: ATA игрока для скина
    #[account(mut)]
    pub user_skin_token: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Skin::INIT_SPACE,
        seeds = [SKIN_SEED, skin_mint.key().as_ref()],
        bump
    )]
    pub skin: Box<Account<'info, Skin>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExchangeFoodEnergy<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, address = config.food_mint @ AofError::InvalidMint)]
    pub food_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_food.mint == food_mint.key(), constraint = user_food.owner == user.key())]
    pub user_food: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [PLAYER_SEED, user.key().as_ref()], bump)]
    pub player: Box<Account<'info, Player>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UseFlask<'info> {
    /// CHECK: игрок-подписант
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.key().as_ref()], bump)]
    pub player_state: Box<Account<'info, Player>>,
    #[account(mut, constraint = user_flask.mint == flask_mint.key(), constraint = user_flask.owner == player.key())]
    pub user_flask: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub flask_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
'''

# Инструкции
new_instructions = '''
    // ===== [НОВОЕ] Инструкции #11 из аудита =====
    
    /// Commit для награды из лука (форж)
    /// Сохраняет SHA-256 hash от secret в PDA
    pub fn bow_reward_commit(ctx: Context<BowRewardCommit>, hash: [u8; 32]) -> Result<()> {
        require!(!ctx.accounts.bow_commit.revealed, AofError::AlreadyRevealed);
        
        let commit = &mut ctx.accounts.bow_commit;
        commit.user = ctx.accounts.user.key();
        commit.tool_mint = ctx.accounts.tool_mint.key();
        commit.hash = hash;
        commit.timestamp = Clock::get()?.unix_timestamp;
        commit.revealed = false;
        
        msg!("bow_reward_commit: user={}, tool={}", 
             commit.user, commit.tool_mint);
        Ok(())
    }
    
    /// Reveal для награды из лука
    /// Проверяет хеш и выдаёт скин
    pub fn bow_reward_reveal(
        ctx: Context<BowRewardReveal>,
        secret: [u8; 32],
        skin_id: u8,
    ) -> Result<()> {
        let commit = &ctx.accounts.bow_commit;
        
        // Проверка хеша
        let computed = anchor_lang::solana_program::hash::hash(&secret);
        require!(commit.hash == computed.to_bytes(), AofError::InvalidReveal);
        
        // Проверка владельца коммита
        require!(commit.user == ctx.accounts.payer.key(), AofError::Unauthorized);
        
        // Сохраняем скин
        let skin = &mut ctx.accounts.skin;
        skin.bow_mint = commit.tool_mint;
        skin.skin_id = skin_id;
        skin.applied_at = Clock::get()?.unix_timestamp;
        
        // Помечаем коммит как использованный
        let commit_mut = &mut ctx.accounts.bow_commit;
        commit_mut.revealed = true;
        
        msg!("bow_reward_reveal: skin_id={}, user={}", skin_id, commit.user);
        Ok(())
    }
    
    /// Обмен FOOD на энергию
    /// 1 FOOD = 10 энергии, максимум 100
    pub fn exchange_food_energy(ctx: Context<ExchangeFoodEnergy>, food_amount: u64) -> Result<()> {
        require!(food_amount > 0, AofError::InvalidAmount);
        
        let user_food = &ctx.accounts.user_food;
        require!(user_food.amount >= food_amount, AofError::InsufficientBalance);
        
        // Вычисляем энергию
        let energy_gain = food_amount
            .checked_mul(FOOD_TO_ENERGY_RATE)
            .ok_or(AofError::MathOverflow)?;
        
        // Применяем к игроку (макс 100)
        let player = &mut ctx.accounts.player;
        let current = player.energy.unwrap_or(0);
        let new_energy = std::cmp::min(
            current.saturating_add(energy_gain as u32),
            MAX_ENERGY
        );
        player.energy = Some(new_energy);
        
        // Сжигаем FOOD
        let cpi_accounts = token::Burn {
            mint: ctx.accounts.food_mint.to_account_info(),
            from: ctx.accounts.user_food.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::burn(CpiContext::new(cpi_program, cpi_accounts), food_amount)?;
        
        msg!("exchange_food_energy: burned {} FOOD, +{} energy (total {})", 
             food_amount, energy_gain, new_energy);
        Ok(())
    }
    
    /// Использование фляги
    /// Сжигает флягу и применяет эффект
    pub fn use_flask(ctx: Context<UseFlask>, flask_type: u8) -> Result<()> {
        let user_flask = &ctx.accounts.user_flask;
        require!(user_flask.amount >= 1, AofError::InsufficientBalance);
        
        let player_state = &mut ctx.accounts.player_state;
        let current_energy = player_state.energy.unwrap_or(0);
        
        match flask_type {
            0 => { // Blue flask: +30 энергии
                let new_energy = std::cmp::min(
                    current_energy.saturating_add(FLASK_BLUE_ENERGY),
                    MAX_ENERGY
                );
                player_state.energy = Some(new_energy);
                msg!("use_flask: blue +{} energy", FLASK_BLUE_ENERGY);
            }
            1 => { // Yellow flask: +50 энергии
                let new_energy = std::cmp::min(
                    current_energy.saturating_add(FLASK_YELLOW_ENERGY),
                    MAX_ENERGY
                );
                player_state.energy = Some(new_energy);
                msg!("use_flask: yellow +{} energy", FLASK_YELLOW_ENERGY);
            }
            2 => { // Green flask: +100 энергии (полное восстановление)
                player_state.energy = Some(MAX_ENERGY);
                msg!("use_flask: green full energy restore");
            }
            3 | 4 => { // Pink/Purple flask: редкие баффы (TODO: расширить)
                msg!("use_flask: rare flask applied (type {})", flask_type);
            }
            _ => return Err(AofError::InvalidFlaskType.into()),
        }
        
        // Сжигаем флягу
        let cpi_accounts = token::Burn {
            mint: ctx.accounts.flask_mint.to_account_info(),
            from: ctx.accounts.user_flask.to_account_info(),
            authority: ctx.accounts.player.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::burn(CpiContext::new(cpi_program, cpi_accounts), 1)?;
        
        Ok(())
    }
'''

# Вставляем Accounts-структуры перед последним #[derive(Accounts)] или в конец перед модулями
# Простой подход: добавляем перед "pub mod aof_core"
if "pub mod aof_core" in content:
    content = content.replace("pub mod aof_core", new_accounts + "\npub mod aof_core", 1)
else:
    print("⚠️  Не найден 'pub mod aof_core'")
    exit(1)

# Вставляем инструкции перед последней } модуля
last_brace = content.rfind('}')
content = content[:last_brace] + new_instructions + '\n' + content[last_brace:]

with open(path, 'w') as f:
    f.write(content)

print("✅ 4 инструкции и 4 Accounts-структуры добавлены")
PYEOF

# ============================================================
# ШАГ 5: Сборка
# ============================================================
echo ""
echo "🔨 Сборка (может занять 5-10 минут)..."
anchor build 2>&1 | tee /tmp/build_impl_v2.log

echo ""
echo "=== Ошибки ==="
grep -E "^error" /tmp/build_impl_v2.log | head -15 || echo "✅ 0 ошибок"

echo ""
echo "=== Последние 15 строк ==="
tail -15 /tmp/build_impl_v2.log

# ============================================================
# ШАГ 6: Проверка, что инструкции в IDL
# ============================================================
echo ""
echo "=== Проверка IDL ==="
if [ -f target/idl/aof_core.json ]; then
    echo "Новые инструкции в IDL:"
    jq -r '.instructions[].name' target/idl/aof_core.json | grep -E "bow_reward|exchange_food|use_flask" || echo "❌ Не найдены в IDL"
fi
