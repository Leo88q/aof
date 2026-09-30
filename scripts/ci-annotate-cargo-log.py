#!/usr/bin/env python3
"""Печатает GitHub-аннотации по логу `cargo test`.

Зачем: `results-receiver.actions.githubusercontent.com` (хост, с которого
скачивается лог job'а) недоступен из части окружений, и тогда красный прогон
неотличим от «красного без причины» — в job'е `Anchor build` видно только
`exit code 101`. Аннотации check-run читаются через API:

    gh api repos/OWNER/REPO/check-runs/<id>/annotations

поэтому каждая ошибка компиляции публикуется вместе с `file=`/`line=` из
rustc-овской строки `-->` и с теми строками диагностики, которые объясняют
причину (`note:`, `has type`, `argument requires`, `must outlive`). Именно
они нужны для разбора инвариантных лайфтаймов `AccountInfo`/`Signer`, из-за
которых падает `remaining_accounts` + CPI.

Проверить сам скрипт: `python3 scripts/ci-annotate-cargo-log.py --self-test`.
"""

import os
import re
import sys

# GitHub держит ~10 аннотаций на шаг, остальное молча теряется.
MAX_ANNOTATIONS = 8
MAX_MESSAGE = 900

ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
ERROR_HEAD = re.compile(r"^error(\[|:)")
LOCATION = re.compile(r"^--> (.*)$")

# Строки, которые объясняют ошибку, а не показывают её картинку.
EXPLAINS = (
    "note:",
    "help:",
    "= note:",
    "= help:",
    "has type",
    "must outlive",
    "argument requires",
    "requirement occurs",
    "which makes",
)


def escape(line):
    """GitHub workflow command escaping, one annotation line."""
    return line.replace("%", "%25").replace("\r", "").replace("\n", "%0A")[:MAX_MESSAGE]


def diagnostic(lines, start):
    """Строка ошибки плюс объясняющие её строки rustc."""
    chunk = [lines[start].strip()]
    for i in range(start + 1, min(start + 60, len(lines))):
        stripped = lines[i].strip()
        if ERROR_HEAD.match(stripped):  # следующая ошибка
            break
        if any(marker in stripped for marker in EXPLAINS) and stripped not in chunk:
            chunk.append(stripped)
        if len(chunk) >= 8:
            break
    return "\n".join(chunk)


def annotations(text):
    """Список готовых workflow-команд по тексту лога."""
    lines = ANSI.sub("", text).splitlines()
    out = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not ERROR_HEAD.match(stripped):
            continue
        if len(out) >= MAX_ANNOTATIONS:
            break
        where = ""
        for j in range(i + 1, min(i + 9, len(lines))):
            match = LOCATION.match(lines[j].strip())
            if match:
                where = match.group(1)
                break
        spot = re.match(r"([^\s:]+):(\d+):(\d+)", where)
        body = escape(diagnostic(lines, i))
        if spot:
            out.append("::error file=%s,line=%s::%s" % (spot.group(1), spot.group(2), body))
        else:
            out.append("::error file=.github::" + body)

    # Дальше — фейлы тестов: имена тестов и значения ассертов.
    tails = [
        l.strip()
        for l in lines
        if re.match(r"^(failures:|test result:|assertion|thread )", l.strip())
        or "panicked at" in l
        or l.strip().startswith("left:")
        or l.strip().startswith("right:")
    ]
    for line in tails[: max(0, 10 - len(out))]:
        out.append("::error file=.github::" + escape(line))
    if not out and not tails:
        for line in lines[-40:]:
            out.append("::error file=.github::" + escape(line))
    return out


SELF_TEST_LOG = """\
error: lifetime may not live long enough
   --> aof-core/src/instructions/rebirth_reset.rs:121:21
    |
38  | pub fn handler(ctx: Context<ResetForRebirth>, season_id: u32) -> Result<()> {
    |                 has type `Context<'_, '_, '_, '_, ResetForRebirth<'2>>`
    |                 has type `Context<'_, '_, '_, '1, ResetForRebirth<'_>>`
121 |                     authority: ctx.accounts.user.to_account_info(),
    |                     ^^^^^^^^^^^ argument requires that `'2` must outlive `'1`
    = note: requirement occurs because of the type `Signer<'_>`, which makes the generic argument `'_` invariant
    = note: the struct `Signer<'info>` is invariant over the parameter `'info`
error: could not compile `aof-core` (lib test) due to 1 previous error
test result: FAILED. 180 passed; 1 failed
"""


def self_test():
    got = annotations(SELF_TEST_LOG)
    joined = "\n".join(got)
    assert got[0].startswith(
        "::error file=aof-core/src/instructions/rebirth_reset.rs,line=121::"
    ), got[0]
    for marker in ("has type", "must outlive", "requirement occurs", "invariant"):
        assert marker in joined, marker
    assert any("test result: FAILED" in g for g in got), got
    # Без локации аннотация всё равно публикуется, но помечена .github.
    plain = annotations("error: something went wrong\n")
    assert plain and plain[0].startswith("::error file=.github::"), plain
    # Лимит аннотаций соблюдается.
    many = annotations("error: boom\n   --> a.rs:1:1\n" * 20)
    assert len(many) <= MAX_ANNOTATIONS, len(many)
    print("ci-annotate-cargo-log: self-test OK (%d checks)" % (len(got) + 3))


def main(argv):
    if "--self-test" in argv:
        self_test()
        return 0
    path = next((a for a in argv[1:] if not a.startswith("-")), "/tmp/unit-tests.log")
    if not os.path.exists(path):
        return 0
    with open(path, encoding="utf-8", errors="replace") as handle:
        for command in annotations(handle.read()):
            print(command)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
