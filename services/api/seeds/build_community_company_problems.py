#!/usr/bin/env python3
"""Build atlas_community_company_problems.csv.gz from
dr-o-ne/leetcode-company-problem-frequency, scoped to companies that have
zero rows in both primary company datasets (build_company_problems.py's
four LeetCode repos and the GFG company-tags scrape).

Provenance note: dr-o-ne/leetcode-company-problem-frequency is a single
scraper. Its "Times"/"Period" columns match the shape of LeetCode's own
(paid) company-tag frequency feature, not crowd-sourced interview
write-ups like the four repos build_company_problems.py merges — we could
not independently confirm where the numbers come from. That is why this
stays in its own source_type = 'community_dataset' layer (see
seed_community_company_problems.py) instead of joining the cross-validated
'dataset' layer, and why COMPANY_FILES below is a fixed, explicit allow-list
rather than "every company in the repo": widening it re-opens the
provenance question and should be a deliberate choice, not a side effect of
re-running this script.

"Block" aliases onto the existing "square" company code: Square Inc.
rebranded to Block Inc. in 2021 and already has rows under "cmp_square" in
the primary LeetCode dataset (built from the four independent repos);
without this alias the community layer would silently fork a disconnected
"cmp_block" company that never merges with that evidence. Not added to
build_company_problems.py's own ALIASES table because applying it there
requires rebuilding the primary CSV from the external repo clones, which is
out of scope here. Re-seeding with this script will rename that company row
from "Square" to "Block" (the display name in EXCLUDED wins on conflict) —
intentional, since "Block" is the current legal name, but worth knowing.

This is one of possibly several community_dataset sources (see also
build_researched_company_tasks.py). seed_community_company_problems.py
takes all of their CSVs together in one invocation and rebuilds the
community_dataset layer per platform from their union — passing only one
CSV would wipe out another source's rows for the same platform on
reseed. See that script's docstring for why.

Usage:
  build_community_company_problems.py --repo <path-to-local-clone> \
      --out atlas_community_company_problems.csv.gz
  build_community_company_problems.py --repo <path> --snapshot 2026-02-22
"""
import argparse
import csv
import gzip
import re
import sys
from datetime import date, timedelta
from pathlib import Path

SOURCE = "dr_o_ne"

# Explicit allow-list: company key (post-alias) -> md filename in the
# upstream repo's companies/ directory. Only companies absent from both
# primary datasets as of 2026-07-23 belong here.
COMPANY_FILES = {
    "anthropic": "anthropic.md",
    "square": "block.md",  # see module docstring: Block -> Square alias
    "canva": "canva.md",
    "chime": "chime.md",
    "epic games": "epic-games.md",
    "etsy": "etsy.md",
    "fortinet": "fortinet.md",
    "peloton": "peloton.md",
    "plaid": "plaid.md",
    "zendesk": "zendesk.md",
}

# Repo's last known push date, used as the reference point for converting
# the source's relative "Period" buckets into absolute last_seen dates.
DEFAULT_SNAPSHOT = date(2026, 2, 22)

PERIOD_OFFSETS = {
    "0 - 3 months": 45,
    "0 - 6 months": 90,
    "6 months ago": 180,
}

ROW_RE = re.compile(
    r"^\|\s*(?P<company>[^|]+?)\s*\|\s*(?P<problem>[^|]+?)\s*\|\s*"
    r"(?P<difficulty>[^|]+?)\s*\|\s*(?P<times>\d+)\s*\|\s*"
    r"(?P<period>[^|]+?)\s*\|\s*(?P<link>[^|]+?)\s*\|\s*$"
)


def slug_from_url(url):
    m = re.search(r"leetcode\.com/problems/([a-z0-9-]+)", url.strip().lower())
    return m.group(1) if m else None


def norm_difficulty(raw):
    d = raw.strip().lower()
    return d if d in ("easy", "medium", "hard") else ""


def parse_file(path, key, snapshot):
    rows = []
    text = path.read_text(encoding="utf-8")
    for line in text.splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue  # header / separator / blank lines
        slug = slug_from_url(m.group("link"))
        if not slug:
            raise ValueError(f"{path}: could not extract slug from {m.group('link')!r}")
        difficulty = norm_difficulty(m.group("difficulty"))
        offset = PERIOD_OFFSETS.get(m.group("period").strip())
        if offset is None:
            raise ValueError(f"{path}: unknown period {m.group('period')!r}")
        last_seen = snapshot - timedelta(days=offset)
        rows.append({
            "platform": "leetcode",
            "code": "cmp_" + re.sub(r"\s+", "_", key),
            "name": m.group("company").strip(),
            "slug": slug,
            "title": m.group("problem").strip(),
            "difficulty": difficulty,
            "times": int(m.group("times")),
            "last_seen": last_seen.isoformat(),
            "url": m.group("link").strip(),
        })
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", required=True,
                         help="path to local clone of dr-o-ne/leetcode-company-problem-frequency")
    parser.add_argument("--out", default="atlas_community_company_problems.csv.gz")
    parser.add_argument("--snapshot", default=DEFAULT_SNAPSHOT.isoformat(),
                         help="repo snapshot date (YYYY-MM-DD), default: last known push date")
    args = parser.parse_args(argv or sys.argv[1:])

    snapshot = date.fromisoformat(args.snapshot)
    companies_dir = Path(args.repo) / "companies"

    all_rows = []
    seen_pairs = set()
    for key, filename in sorted(COMPANY_FILES.items()):
        fp = companies_dir / filename
        if not fp.exists():
            raise SystemExit(f"missing {fp} — is --repo pointing at a real clone?")
        for row in parse_file(fp, key, snapshot):
            pair = (row["code"], row["slug"])
            if pair in seen_pairs:
                continue  # same problem re-listed under two period buckets
            seen_pairs.add(pair)
            all_rows.append(row)

    with gzip.open(args.out, "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["platform", "company_code", "company_name", "slug", "title", "difficulty",
                    "evidence_count", "last_seen", "sources", "problem_url"])
        for r in sorted(all_rows, key=lambda r: (r["code"], r["slug"])):
            w.writerow([r["platform"], r["code"], r["name"], r["slug"], r["title"], r["difficulty"],
                        r["times"], r["last_seen"], SOURCE, r["url"]])

    companies = len({r["code"] for r in all_rows})
    print(f"wrote {args.out}: {companies} companies, {len(all_rows)} pairs", file=sys.stderr)


if __name__ == "__main__":
    main()
