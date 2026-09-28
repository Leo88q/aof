#!/usr/bin/env python3
"""Supplementary triage, NOT a replacement for gitleaks/trufflehog.
Prints only paths, line numbers and detector names; never matched values.
History mode scans every reachable blob, including remote refs/tags/stash.
No network verification of potentially live credentials is performed.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

RULES = {
    'solana-64-byte-array': r'\[(?:\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\]',
    'base58-87-88': r'(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{87,88}(?![1-9A-HJ-NP-Za-km-z])',
    'evm-32-byte-hex': r'\b0x[a-fA-F0-9]{64}\b',
    'telegram-token': r'\b\d{8,10}:[A-Za-z0-9_-]{35}\b',
    'private-key-pem': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'provider-key-url': r'https?://[^\s\x22\x27<>]*(?:helius|quicknode|alchemy|infura)[^\s\x22\x27<>]*',
    'database-url': r'(?:postgres(?:ql)?|mongodb(?:\+srv)?)://[^\s\x22\x27<>]+',
    'secret-keywords': r'(?i)\b(?:mnemonic|seed phrase|secretKey|privateKey|bearer|api_key|apikey|secret|password|token|authorization|service_role|firebase|smtp|stripe|webhook|AWS_ACCESS_KEY_ID|GOOGLE_APPLICATION_CREDENTIALS)\b',
}
SKIP = {'.git', 'node_modules', '.cache', '.venv', '__pycache__'}


def scan(data, path, oid=None):
    if b'\0' in data:
        return
    text = data.decode('utf-8', errors='replace')
    for rule, pattern in RULES.items():
        lines = sorted({text.count('\n', 0, m.start()) + 1 for m in re.finditer(pattern, text)})
        if lines:
            print(json.dumps(dict(path=path, blob=oid, detector=rule, lines=lines)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--history', action='store_true')
    parser.add_argument('--root', default='.')
    args = parser.parse_args()
    if args.history:
        objects = subprocess.check_output(['git', 'rev-list', '--objects', '--all']).decode().splitlines()
        proc = subprocess.Popen(['git', 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        for obj in objects:
            oid, _, path = obj.partition(' ')
            proc.stdin.write((oid + '\n').encode())
            proc.stdin.flush()
            header = proc.stdout.readline().split()
            size = int(header[2])
            data = proc.stdout.read(size)
            proc.stdout.read(1)
            if header[1] == b'blob':
                scan(data, path, oid)
        proc.stdin.close()
        if proc.wait() != 0:
            raise SystemExit('git cat-file failed')
    else:
        for path in sorted(Path(args.root).rglob('*')):
            if any(part in SKIP for part in path.parts) or path.is_symlink() or not path.is_file():
                continue
            scan(path.read_bytes(), str(path))


if __name__ == '__main__':
    main()
