use anchor_lang::prelude::*;

#[account]
pub struct RebirthRecord {
    pub user: Pubkey,
    pub bump: u8,
    /// Текущее поколение (начинается с 1)
    pub generation: u16,
    /// Сколько ребёртов совершено
    pub rebirth_count: u8,
    /// Накопленный постоянный бонус в bps
    pub permanent_bonus_bps: u16,
    pub last_rebirth_ts: i64,
}

impl RebirthRecord {
    pub const SIZE: usize = 8 + 32 + 1 + 2 + 1 + 2 + 8;

    /// Титул по поколению (для фронтенда)
    pub fn title(&self) -> &'static str {
        match self.generation {
            1 => "Fermier",
            2 => "Fermier de 2eme generation",
            3..=5 => "Veteran de la ferme",
            6..=10 => "Legende de la ferme",
            _ => "Ancetre de la recolte",
        }
    }
}
