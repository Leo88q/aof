#!/usr/bin/env python3
"""Generate an honest remediation review of the pinned external baseline.
This is NOT Sentio/SolGuard/SLAM output and never resolves findings by itself.
"""
import collections
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
base = json.loads((ROOT / 'reports/aof-hub-baseline.json').read_text())
# Evidence maps in the same order as the immutable baseline.
reviews = [
 ('pub struct DoRebirth', 'mitigated-disabled', 'Fail-closed FeatureDisabled до изменения экономики; init_if_needed сохранён для повторного rebirth.', 'Без атомарного сброса прогресса включение создаст бонус без положенного sink.'),
 ('pub fn cancel_limit_order', 'patched-awaiting-runtime', 'Reload обоих SPL token accounts после CPI; order не reload, иначе теряется active=false.', 'Stale balance или повторная отмена могут искажать escrow/refund.'),
 ('pub fn set_fees', 'present-awaiting-runtime', 'GlobalFeesUpdated уже был в исходном checkout; защита от удаления emit в CI.', 'Неучтённая смена fees искажает доходность и сверку treasury.'),
 ('pub fn set_paused', 'present-awaiting-runtime', 'GlobalPausedUpdated уже был в исходном checkout.', 'Невидимый pause затрудняет остановку потерь.'),
 ('pub fn cancel_limit_order', 'present-awaiting-runtime', 'LimitOrderCancelled уже был в исходном checkout.', 'Без события отмены ledger сохраняет фиктивную liability.'),
 ('pub lp_pool:', 'review-required', 'init_if_needed нужен для повторного депозита; checked_add сохраняет counters; close/assign/drain путей нет.', 'Сброс shares/reserve способен обесценить LP-позиции.'),
 ('pub lp_position:', 'review-required', 'init_if_needed нужен для повторного депозита; shares прибавляются, deposited_at заполняется лишь один раз; проверены user/rarity.', 'Сброс или подмена позиции нарушает право на резерв.'),
 ('.checked_div(assets)', 'present-awaiting-runtime', 'checked_div уже присутствовал; добавлено 10000 детерминированных full-u64 property случаев.', 'Нулевые assets либо overflow не должны создавать shares или блокировать процесс panic.'),
 ('.checked_div(total as u128)', 'present-awaiting-runtime', 'checked_div и shares<=total уже присутствовали; дополнены экстремальные случаи.', 'Вывод не должен превысить principal/fees резервы.'),
 ('pub struct SessionCheckAndSpend', 'patched-awaiting-runtime', 'authority теперь Signer; добавлен негативный Anchor try_accounts тест; spending по-прежнему отключён.', 'Без авторизации можно резервировать чужой spending budget; атомарная привязка CPI всё ещё отсутствует.'),
 ('pub struct TrustSnapshotUpdate', 'review-required', 'Oracle signer/has_one, system owner субъекта, identity constraint, monotonic epoch; overwrite score является авторизованным обновлением, не reset budget.', 'Компрометация oracle меняет trust tier и будущие лимиты; signer владельца не заменяет oracle governance.'),
 ('pub struct SessionCreate', 'patched-awaiting-runtime', 'init вместо init_if_needed; исправлен SESSION_SPACE с 130 на 146; создание остаётся disabled.', 'Повторное создание не должно сбрасывать spent_today/revocation.'),
 ('pub struct TrustSnapshotUpdate', 'patched-awaiting-runtime', 'Владелец user проверяется через owner=System; stored trust.user связан с seed; oracle подписывает обновление.', 'Чужой snapshot не должен увеличивать лимит игрока.'),
 ('pub struct SessionCheckAndSpend', 'patched-awaiting-runtime', 'Signer authority + seeds + stored authority/session_signer constraints; негативные тесты подмены.', 'Подмена namespace может использовать чужой лимит.'),
 ('pub fn session_revoke', 'present-awaiting-runtime', 'SessionRevokedEvent уже присутствовал; source regression запрещает удаление.', 'Необнаруженная ревокация позволяет off-chain ботам продолжать попытки расхода.'),
 ('pub fn session_pause', 'present-awaiting-runtime', 'SessionPausedEvent уже присутствовал.', 'Невидимый pause мешает security monitoring и остановке бота.'),
 ('pub struct DrumReveal', 'patched-awaiting-runtime', 'user явно address=drum_commit.user; seeds, stored relation, authority signer и close сохраняются.', 'Подмена получателя или повторный reveal выводят prize treasury.'),
]
findings = []
for f, (needle, status, reason, consequence) in zip(base['findings'], reviews):
    path = f['location']['path'].removeprefix('./')
    lines = (ROOT / path).read_text().splitlines()
    line = next(i for i, text in enumerate(lines, 1) if needle in text)
    finding = dict(f)
    finding.update(baselineLocation=f['location'], location=dict(path=path, line=line, column=1),
                   reviewStatus=status, resolution='open-pending-independent-validation',
                   reason=reason, economicConsequence=consequence, acceptedRisk=False,
                   owner=None, blockingReason='Rust/SVM negative execution and independent rescan not available in this sandbox')
    findings.append(finding)
result = dict(schemaVersion=1, gameId='aof', reportType='remediation-review-NOT-external-rescan',
              reviewedOn='2026-09-23', hubRevision='1aea14c7c9422022d8581abcca25649e8d2edd24',
              baselineSha256=hashlib.sha256((ROOT/'reports/aof-hub-baseline.json').read_bytes()).hexdigest(),
              productionReady=False, maturityClaim='L1; partial W1 remediation, NOT L3/L4',
              externalScanners={'Sentio':'not-run', 'SolGuard':'not-run', 'SLAM':'not-run'},
              files_scanned=None, files_parsed=None,
              unresolvedBaselineBySeverity=dict(collections.Counter(f['severity'] for f in findings)),
              formalAcceptedRisks=[], findings=findings,
              additionalFindings=[
                  dict(id='AOF-RLS-01', severity='high', location={'path':'src/os/sql/cross_game_materials.sql','line':34}, status='patched-tested-postgresql', reason='OR tenant=aof leaked rows; role-scoped policy and isolated cached view now tested'),
                  dict(id='AOF-SPACE-01', severity='high', location={'path':'programs/aof-session-keys/src/lib.rs','line':10}, status='patched-awaiting-rust-test', reason='SESSION_SPACE omitted two i64 timestamps'),
                  dict(id='AOF-EV-01', severity='medium', location={'path':'programs/aof-quests/src/instructions/drum/drum_reveal.rs','line':239}, status='patched-awaiting-rust-test', reason='Drum EV test truncated each term; compare weighted numerator to price*10000'),
              ])
(ROOT/'reports/aof-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
rows=['# Непринятые findings внешнего baseline', '',
      'Это review, не новый внешний аудит. Ни один finding не помечен accepted-risk; владелец должен быть назначен командой. Все 17 остаются открытыми до независимой проверки.', '',
      '| Rule | Severity | Текущий файл:строка | Причина / изменение | Экономическое последствие |',
      '|---|---|---|---|---|']
for f in findings:
    rows.append(f"| {f['rule_id']} | {f['severity']} | `{f['location']['path']}:{f['location']['line']}` | {f['reason']} Не принят: нет Rust/SVM execution + независимого rescan. | {f['economicConsequence']} |")
(ROOT/'reports/AOF_FINDINGS.md').write_text('\n'.join(rows)+'\n')
print('Wrote review: original 1 critical / 11 high / 5 low remain pending validation, NOT a clean audit.')
