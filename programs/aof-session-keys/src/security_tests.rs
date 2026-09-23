//! Host-side Anchor account-validation tests. These exercise generated
//! try_accounts, not a second implementation of the authorization policy.
use super::*;
use std::collections::BTreeSet;

fn info(key: Pubkey, signer: bool, owner: Pubkey, data: Vec<u8>) -> AccountInfo<'static> {
    AccountInfo::new(
        Box::leak(Box::new(key)), signer, true,
        Box::leak(Box::new(10_000_000)), Box::leak(data.into_boxed_slice()),
        Box::leak(Box::new(owner)), false, 0,
    )
}

fn validate(owner_signed: bool, substitute_pda: bool, substitute_owner: bool) -> Result<()> {
    let owner = Pubkey::new_unique();
    let delegate = Pubkey::new_unique();
    let session = SessionToken {
        authority: if substitute_owner { Pubkey::new_unique() } else { owner },
        session_signer: delegate, target_program: Pubkey::new_unique(),
        allowed_ixs: IX_MARKETPLACE_CANCEL, max_amount_per_tx: 10_000_000,
        spent_today: 0, day_start: 0, valid_until: i64::MAX, revoked: false, paused: false,
    };
    let mut data = Vec::new();
    session.try_serialize(&mut data).unwrap();
    let pda = Pubkey::find_program_address(&[SESSION_SEED, owner.as_ref()], &crate::ID).0;
    let accounts = vec![
        info(delegate, true, anchor_lang::system_program::ID, vec![]),
        info(owner, owner_signed, anchor_lang::system_program::ID, vec![]),
        info(if substitute_pda { Pubkey::new_unique() } else { pda }, false, crate::ID, data),
    ];
    let mut slice: &'static [AccountInfo<'static>] = Box::leak(accounts.into_boxed_slice());
    SessionCheckAndSpend::try_accounts(
        &crate::ID, &mut slice, &[], &mut SessionCheckAndSpendBumps::default(), &mut BTreeSet::new(),
    ).map(|_| ())
}

#[test]
fn unsigned_authority_is_rejected_by_anchor() {
    let err = validate(false, false, false).unwrap_err();
    assert!(err.to_string().contains("AccountNotSigner"), "{err}");
}

#[test]
fn signed_authority_still_cannot_substitute_session_or_owner() {
    assert!(validate(true, true, false).unwrap_err().to_string().contains("ConstraintSeeds"));
    assert!(validate(true, false, true).unwrap_err().to_string().contains("Unauthorized"));
    assert!(validate(true, false, false).is_ok());
}

#[test]
fn allocated_session_space_includes_both_timestamps() {
    let session = SessionToken {
        authority: Pubkey::default(), session_signer: Pubkey::default(), target_program: Pubkey::default(),
        allowed_ixs: 0, max_amount_per_tx: 0, spent_today: 0, day_start: 0, valid_until: 0,
        revoked: false, paused: false,
    };
    let mut data = Vec::new();
    session.try_serialize(&mut data).unwrap();
    assert_eq!(SESSION_SPACE, data.len());
    assert_eq!(SESSION_SPACE, 146);
}
