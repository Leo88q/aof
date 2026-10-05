pub mod initialize;
pub mod authority;
pub mod admin_config;
pub mod set_fees;
pub mod set_paused;
pub mod set_resource_mints;
pub mod set_craft_economy;
pub mod init_craft_economy;
pub mod init_rarity_counter;
pub mod init_material_mints;
pub mod plant_neuron;
pub mod harvest_synapse;
pub mod use_flask;
pub mod exchange_data_energy;
pub mod start_signal_processing;
pub mod collect_signal;
pub mod start_model_training;
pub mod collect_model;
pub mod weather_crank;
pub mod collect_power;
pub mod craft_recipe;
pub mod deposit_gas;
pub mod withdraw_gas;
pub mod sweep_gas_fees;
pub mod mint_resource;
pub mod player;
pub mod burn_resource;
pub mod mint_tool;
pub mod burn_tool;
pub mod craft;
pub mod reroll;
pub mod stake;
pub mod unstake;
pub mod start_mining;
pub mod collect_mining;
pub mod repair;
pub mod burn_nft;
pub mod pay_out;
pub mod collector_stake;
pub mod collector_unstake;
pub mod adjust_player_capacity;

// ===== [НОВОЕ] полная реализация TOR v4 =====
pub mod pack_config;
pub mod pack_open_commit;
pub mod pack_open_reveal;
pub mod pack_open_expire;
// [F-06] Switchboard On-Demand pool and shared settlement helpers.
pub mod vrf_pool;
pub mod settlement;
pub mod reroll_random;
pub mod exploration;
pub mod referral;
pub mod forge;
pub mod lottery;
pub mod marketplace;
pub mod auction;
pub mod offer;
pub mod rental;
// [Этап 8] Делегированные действия арендатора: mining/collect/repair по активной аренде.
pub mod rental_delegation;
pub mod orderbook;
pub mod craft_order;
pub mod season;
// [§3.4] полный сброс перерождения одним действием
pub mod rebirth_reset;

pub mod mint_resource_once;
pub mod issuance_cap;
pub mod roles;

// [AUDIT F-02/F-03/F-27] lib.rs calls these handlers as `instructions::<fn>`
// (the new admin/governance instructions live in `authority` / `admin_config`),
// so re-export them at the crate-instructions root. Without this the crate does
// not compile: `instructions::set_pending_authority` would be unresolved.
pub use authority::{accept_authority, cancel_pending_authority, set_pending_authority};
pub use admin_config::{set_issuance_lifetime_baseline, set_mining_enabled, set_supply_cap};
pub mod tool_transfer;
pub mod tool_ownership;
pub mod sync_tool_owner;
pub mod tool_metadata;
