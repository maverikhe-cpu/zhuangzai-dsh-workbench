#!/usr/bin/env python3
"""Summarize one explicitly collected, single-scope set of dispatch pages."""
import argparse
import collections
import json
import math
import sys
from pathlib import Path


def summarize(document):
    pages = document.get('pages')
    if not isinstance(pages, list) or not pages:
        raise ValueError('pages must contain at least one successful response')
    by_page = {}
    for page in pages:
        number, size, total, items = (page.get(k) for k in ('page', 'pageSize', 'total', 'items'))
        if (not isinstance(number, int) or number < 1 or not isinstance(size, int)
                or size < 1 or not isinstance(total, int) or total < 0 or not isinstance(items, list)):
            raise ValueError('each page needs valid page, pageSize, total and items')
        if number in by_page:
            raise ValueError(f'duplicate page {number}')
        by_page[number] = page
    sizes = {p['pageSize'] for p in pages}
    totals = {p['total'] for p in pages}
    if len(sizes) != 1 or len(totals) != 1:
        raise ValueError('pageSize or total changed; recollect one consistent scope')
    size, total = next(iter(sizes)), next(iter(totals))
    expected = max(1, math.ceil(total / size))
    if set(by_page) != set(range(1, expected + 1)):
        raise ValueError(f'missing or unexpected pages; expected 1..{expected}')
    rows = []
    for number in range(1, expected + 1):
        items = by_page[number]['items']
        required = min(size, max(0, total - (number - 1) * size))
        if len(items) != required:
            raise ValueError(f'page {number}: expected {required} items, got {len(items)}')
        rows.extend(items)
    seen = set()
    statuses = collections.Counter()
    valid, invalid_counts, unknown_counts, gaps = [], 0, 0, []
    for row in rows:
        key = row.get('applicationId')
        if not key or key in seen:
            raise ValueError('missing or duplicate applicationId; recheck pagination')
        seen.add(key)
        status = row.get('status')
        statuses[status or '(missing)'] += 1
        if status in ('rejected', 'revoked'):
            invalid_counts += 1
            continue
        if status not in ('pending', 'dispatched'):
            unknown_counts += 1
            continue
        req, assigned = row.get('requestedPeopleCount'), row.get('dispatchedPeopleCount')
        if not isinstance(req, int) or isinstance(req, bool) or req < 1 or not isinstance(assigned, int) or isinstance(assigned, bool) or assigned < 0:
            unknown_counts += 1
            continue
        valid.append(row)
        if req > assigned:
            gaps.append({'applicationId': key, 'applicationNo': row.get('applicationNo'),
                         'projectId': row.get('projectId'), 'projectAddress': row.get('projectAddress'),
                         'tags': row.get('tags'), 'entryDate': row.get('entryDate'),
                         'requested': req, 'assigned': assigned, 'gap': req - assigned})
    groups = {}
    for row in gaps:
        group = (row['projectId'], row['tags'])
        if not group[0] or not group[1]:
            raise ValueError('missing projectId or tags for grouped gap; inspect data')
        if group not in groups:
            groups[group] = {'projectId': group[0], 'tags': group[1], 'applications': 0, 'gap': 0}
        groups[group]['applications'] += 1
        groups[group]['gap'] += row['gap']
    return {'total': total, 'pages': expected, 'statuses': dict(statuses),
            'excluded_rejected_or_revoked': invalid_counts, 'needs_review': unknown_counts,
            'valid_count': len(valid), 'requested_sum': sum(r['requestedPeopleCount'] for r in valid),
            'assigned_sum': sum(r['dispatchedPeopleCount'] for r in valid),
            'understaffed_count': len(gaps), 'gap_sum': sum(r['gap'] for r in gaps),
            'gaps': sorted(gaps, key=lambda r: (-r['gap'], r['applicationId'])),
            'groups': sorted(groups.values(), key=lambda r: (-r['gap'], r['projectId'], r['tags']))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pages_json', type=Path, help='JSON object with pages array from a single authorized query')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        result = summarize(json.loads(args.pages_json.read_text(encoding='utf-8')))
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
        print(f'Cannot produce a complete summary: {exc}', file=sys.stderr)
        return 1
    print(f"已汇总 {result['total']} 条、{result['pages']} 页；待核实 {result['needs_review']} 条。")
    return 0


if __name__ == '__main__':
    sys.exit(main())
