"""Synthetic regression cases for the shipped dispatch aggregation helper."""
import importlib.util
from pathlib import Path
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'presets/zhuangzai/skills/zhuangzai-delivery-management/scripts/summarize_dispatch.py'
spec = importlib.util.spec_from_file_location('dispatch_summary', MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(key, requested=2, assigned=0, status='pending'):
    return dict(applicationId=key, requestedPeopleCount=requested,
                dispatchedPeopleCount=assigned, status=status,
                projectId='synthetic-project', tags='synthetic-trade')


def document(rows):
    return dict(pages=[dict(page=1, pageSize=10, total=len(rows), items=rows)])


class DispatchSummaryTests(unittest.TestCase):
    def test_overallocation_does_not_cancel_other_gaps(self):
        result = module.summarize(document([row('a', 2, 4), row('b', 3, 1), row('c', 5, 0, 'revoked')]))
        self.assertEqual(result['gap_sum'], 2)
        self.assertEqual(result['valid_count'], 2)
        self.assertEqual(result['excluded_rejected_or_revoked'], 1)

    def test_missing_and_unknown_values_need_review(self):
        result = module.summarize(document([row('a', 0), row('b', status='unknown'), row('c', requested=None)]))
        self.assertEqual(result['needs_review'], 3)
        self.assertEqual(result['valid_count'], 0)

    def test_missing_pages_and_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):
            module.summarize(dict(pages=[dict(page=1, pageSize=1, total=2, items=[row('a')])]))
        with self.assertRaises(ValueError):
            module.summarize(document([row('a'), row('a')]))

    def test_empty_complete_scope(self):
        self.assertEqual(module.summarize(document([]))['total'], 0)


if __name__ == '__main__':
    unittest.main()
