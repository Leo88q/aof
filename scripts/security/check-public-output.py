#!/usr/bin/env python3
"""Fail closed on accidental source/private-file publication. No values logged.
Not a general-purpose secret detector: also run gitleaks + trufflehog on output.
"""
import re
import sys
from pathlib import Path

PRIVATE_DIRS = {'.git', '.github', 'node_modules', 'src', 'server', 'admin', 'prisma', 'docs', 'tests'}
PRIVATE_SUFFIXES = {'.map', '.ts', '.tsx', '.rs', '.gd', '.py', '.sql', '.sqlite', '.sqlite3', '.db', '.dump', '.bak', '.pem', '.key', '.p12', '.pfx', '.keystore', '.psd', '.blend', '.fig', '.zip', '.gz', '.br'}
PRIVATE_NAMES = {'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'dockerfile', 'docker-compose.yml', '.npmrc', '.gitignore', '.ds_store', 'readme.md', 'id.json'}
PATTERNS = {
    'source-map-reference': r'(?://[#@]|/\*[#@])\s*sourceMappingURL\s*=',
    'private-key-pem': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'telegram-token': r'\b\d{8,10}:[A-Za-z0-9_-]{35}\b',
    'credential-url': r'(?:postgres(?:ql)?|mongodb(?:\+srv)?)://[^\s\x22\x27<>]*:[^\s\x22\x27<>]*@',
    'rpc-key-url': r'https?://[^\s\x22\x27<>]*(?:helius|quicknode|alchemy|infura)[^\s\x22\x27<>]*(?:api[-_]?key=|/v[23]/)[A-Za-z0-9_-]+',
}


def inspect(root):
    root = Path(root)
    if not root.is_dir() or not (root / 'index.html').is_file():
        return ['Missing output directory or index.html']
    failures = []
    for p in sorted(root.rglob('*')):
        rel = p.relative_to(root)
        name = p.name.lower()
        if p.is_symlink():
            failures.append(f'{rel}: symlink forbidden')
            continue
        if not p.is_file():
            continue
        if (any(part.lower() in PRIVATE_DIRS for part in rel.parts)
                or p.suffix.lower() in PRIVATE_SUFFIXES or name in PRIVATE_NAMES
                or name.startswith(('.env', 'credentials', 'secrets'))
                or (name.endswith('.json') and name.startswith(('keypair', 'wallet', 'serviceaccount')))):
            failures.append(f'{rel}: private/source filename')
        data = p.read_bytes()
        if b'\0' in data:
            continue
        text = data.decode('utf-8', errors='replace')
        for detector, pattern in PATTERNS.items():
            if re.search(pattern, text, re.I):
                failures.append(f'{rel}: {detector}')
    return failures


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: check-public-output.py OUTPUT_DIR')
    failures = inspect(sys.argv[1])
    for failure in failures:
        print(failure, file=sys.stderr)
    if failures:
        raise SystemExit(1)
    print('Public output file/content gate passed (not a complete secret scan).')
