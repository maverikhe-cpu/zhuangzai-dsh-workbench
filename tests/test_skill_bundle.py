"""Validate shipped skill navigation and that both preset entrypoints load one persona."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'presets/zhuangzai/skills'

class SkillBundleTests(unittest.TestCase):
    def test_all_local_markdown_links_resolve_inside_bundle(self):
        for file in BASE.rglob('*.md'):
            for target in re.findall(r'\]\(([^)#]+)(?:#[^)]*)?\)', file.read_text()):
                if '://' in target:
                    continue
                resolved = (file.parent / target).resolve()
                self.assertTrue(resolved.is_relative_to(BASE), (file, target))
                self.assertTrue(resolved.is_file(), (file, target))

    def test_route_table_has_ten_resolvable_scenarios(self):
        file = BASE / 'zhuangzai-delivery-management/SKILL.md'
        rows = [line for line in file.read_text().splitlines() if line.startswith('|') and 'references/' in line]
        self.assertEqual(len(rows), 10)
        for row in rows:
            for target in re.findall(r'`(references/[^`]+)`', row):
                self.assertTrue((file.parent / target).is_file(), target)

    def test_legacy_entrypoints_link_to_same_source(self):
        wrappers = list(BASE.glob('yiqizhuang-*/SKILL.md'))
        self.assertEqual(len(wrappers), 10)
        for file in wrappers:
            self.assertIn('../zhuangzai-delivery-management/SKILL.md', file.read_text())

    def test_presets_load_the_same_persona(self):
        canonical = (ROOT / 'presets/zhuangzai/persona.md').read_text().strip()
        for relative in ['cordis.patch.yml','presets/zhuangzai/agent.cordis.yml']:
            text=(ROOT/relative).read_text().split('prefix: |-\n',1)[1]
            lines=[]
            indent=len(text.splitlines()[0])-len(text.splitlines()[0].lstrip())
            for line in text.splitlines():
                if line.strip() and len(line)-len(line.lstrip())<indent: break
                lines.append(line[indent:])
            self.assertEqual('\n'.join(lines).strip(), canonical)

if __name__ == '__main__': unittest.main()
