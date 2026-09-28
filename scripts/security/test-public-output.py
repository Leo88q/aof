#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('gate', Path(__file__).with_name('check-public-output.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class PublicOutputTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'index.html').write_text('<html lang="en"></html>')

    def test_clean(self):
        (self.root / 'app.js').write_text('console.log("public");')
        (self.root / 'wallet-banner.png').write_bytes(b'\x00image')
        self.assertEqual(gate.inspect(self.root), [])

    def test_private_names(self):
        for name in ['.env.production', 'bundle.js.map', 'wallet-main.json', 'dump.sql', 'backup.zip', '.git/HEAD', 'src/main.tsx']:
            with self.subTest(name=name):
                p = self.root / name
                p.parent.mkdir(exist_ok=True)
                p.write_text('fixture')
                self.assertTrue(gate.inspect(self.root))
                p.unlink()

    def test_content_without_value_disclosure(self):
        for value in ['//# sourceMappingURL=app.map', '-----BEGIN PRIVATE KEY-----', 'postgres://user:fixture-password@host/db', 'https://mainnet.helius-rpc.com/?api-key=fixture']:
            with self.subTest(value=value):
                (self.root / 'app.js').write_text(value)
                errors = gate.inspect(self.root)
                self.assertTrue(errors)
                self.assertNotIn(value, '\n'.join(errors))

    def test_symlink(self):
        (self.root / 'outside').symlink_to('/etc/passwd')
        self.assertTrue(gate.inspect(self.root))

    def test_missing_build(self):
        (self.root / 'index.html').unlink()
        self.assertTrue(gate.inspect(self.root))


if __name__ == '__main__':
    unittest.main()
