#!/usr/bin/env python3
"""Rebuild atlas_company_problems.csv.gz from public LeetCode company-wise repos.

Independent sources (clone them locally and pass the paths):
  --liquidslr    github.com/liquidslr/leetcode-company-wise-problems
                 (liquidslr/interview-company-wise-problems is a byte-identical
                  mirror -> NOT a separate source)
  --snehasishroy github.com/snehasishroy/leetcode-companywise-interview-questions
                 (hitarth-gg/visor-leetcode is a viewer over this dataset -> alias)
  --krishnadey30 github.com/krishnadey30/LeetCode-Questions-CompanyWise
  --hxu296       github.com/hxu296/leetcode-company-wise-problems-2022

evidence_count = number of independent sources citing (company, slug).
last_seen      = max over sources of a recency estimate: the most recent
                 period bucket the problem appears in, offset back from the
                 repo's last-commit date (DEFAULT_SNAPSHOTS are the dates of
                 the 2026-07-11 build). Problems seen only in "all time"
                 buckets carry no estimate.

Companies with fewer than MIN_PROBLEMS_PER_COMPANY distinct problems are
dropped as noise (misspelled one-off folders etc.).
"""
import argparse
import csv
import gzip
import re
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

DEFAULT_SNAPSHOTS = {
    "liquidslr": date(2026, 6, 25),
    "snehasishroy": date(2026, 5, 24),
    "krishnadey30": date(2023, 4, 1),
    "hxu296": date(2022, 5, 15),
}

# company-name aliases merged into one canonical key
ALIASES = {"facebook": "meta"}

MIN_PROBLEMS_PER_COMPANY = 5


def norm_key(raw):
    key = re.sub(r"[^a-z0-9]+", " ", raw.lower()).strip()
    return ALIASES.get(key, key)


def slug_from_url(url):
    m = re.search(r"leetcode\.com/problems/([a-z0-9-]+)", url.strip().lower())
    return m.group(1) if m else None


def norm_difficulty(raw):
    d = raw.strip().lower()
    return d if d in ("easy", "medium", "hard") else ""


class Aggregate:
    def __init__(self):
        # (company_key, slug) -> {"sources": set, "last_seen": date|None}
        self.pairs = defaultdict(lambda: {"sources": set(), "last_seen": None})
        self.display = {}  # company_key -> display name
        self.meta = {}     # slug -> (title, difficulty)

    def feed(self, source, company_raw, slug, title, difficulty, last_seen):
        key = norm_key(company_raw)
        if not key or not slug:
            return
        if key not in self.display or (self.display[key].islower() and not company_raw.islower()):
            self.display[key] = "Meta" if key == "meta" else company_raw.strip()
        p = self.pairs[(key, slug)]
        p["sources"].add(source)
        if last_seen and (p["last_seen"] is None or last_seen > p["last_seen"]):
            p["last_seen"] = last_seen
        if slug not in self.meta or (not self.meta[slug][1] and difficulty):
            self.meta[slug] = (title.strip(), difficulty)


def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        yield from csv.DictReader(f)


def load_period_dirs(agg, source, root, snap, buckets, url_field, title_field, diff_field):
    for company_dir in sorted(Path(root).iterdir()):
        if not company_dir.is_dir() or company_dir.name.startswith("."):
            continue
        for fname, offset in buckets.items():
            fp = company_dir / fname
            if not fp.exists():
                continue
            seen = snap - timedelta(days=offset) if offset is not None else None
            for row in read_csv(fp):
                slug = slug_from_url(row.get(url_field) or "")
                agg.feed(source, company_dir.name, slug, row.get(title_field) or "",
                         norm_difficulty(row.get(diff_field) or ""), seen)


def load_krishnadey30(agg, root, snap):
    buckets = {"6months": 90, "1year": 270, "2year": 540, "alltime": None}
    for fp in sorted(Path(root).glob("*.csv")):
        m = re.match(r"(.+)_(6months|1year|2year|alltime)$", fp.stem)
        if not m:
            continue
        offset = buckets[m.group(2)]
        seen = snap - timedelta(days=offset) if offset is not None else None
        for row in read_csv(fp):
            url = row.get("Leetcode Question Link") or row.get(" Leetcode Question Link") or ""
            agg.feed("krishnadey30", m.group(1), slug_from_url(url), row.get("Title") or "",
                     norm_difficulty(row.get("Difficulty") or ""), seen)


def load_hxu296(agg, root, snap):
    # single 2022 snapshot without recency buckets: a conservative half-year lag
    seen = snap - timedelta(days=180)
    for fp in sorted((Path(root) / "companies").glob("*.csv")):
        for row in read_csv(fp):
            agg.feed("hxu296", fp.stem, slug_from_url(row.get("problem_link") or ""),
                     row.get("problem_name") or "", "", seen)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for src in ("liquidslr", "snehasishroy", "krishnadey30", "hxu296"):
        parser.add_argument(f"--{src}", required=True, help=f"path to the {src} repo clone")
    parser.add_argument("--out", default="atlas_company_problems.csv.gz")
    args = parser.parse_args()

    agg = Aggregate()
    load_period_dirs(agg, "liquidslr", args.liquidslr, DEFAULT_SNAPSHOTS["liquidslr"], {
        "1. Thirty Days.csv": 0,
        "2. Three Months.csv": 45,
        "3. Six Months.csv": 135,
        "4. More Than Six Months.csv": 270,
        "5. All.csv": None,
    }, "Link", "Title", "Difficulty")
    load_period_dirs(agg, "snehasishroy", args.snehasishroy, DEFAULT_SNAPSHOTS["snehasishroy"], {
        "thirty-days.csv": 0,
        "three-months.csv": 45,
        "six-months.csv": 135,
        "more-than-six-months.csv": 270,
        "all.csv": None,
    }, "URL", "Title", "Difficulty")
    load_krishnadey30(agg, args.krishnadey30, DEFAULT_SNAPSHOTS["krishnadey30"])
    load_hxu296(agg, args.hxu296, DEFAULT_SNAPSHOTS["hxu296"])

    by_company = defaultdict(list)
    for (key, slug), p in agg.pairs.items():
        by_company[key].append((slug, p))
    kept = {k: v for k, v in by_company.items() if len(v) >= MIN_PROBLEMS_PER_COMPANY}

    print(f"companies: raw={len(by_company)} kept={len(kept)}; pairs={sum(map(len, kept.values()))}",
          file=sys.stderr)

    with gzip.open(args.out, "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["company_code", "company_name", "slug", "title", "difficulty",
                    "evidence_count", "last_seen", "sources"])
        for key in sorted(kept):
            code = "cmp_" + re.sub(r"\s+", "_", key)
            for slug, p in sorted(kept[key]):
                title, diff = agg.meta.get(slug, ("", ""))
                w.writerow([code, agg.display[key], slug, title, diff, len(p["sources"]),
                            p["last_seen"].isoformat() if p["last_seen"] else "",
                            "|".join(sorted(p["sources"]))])
    print(f"wrote {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
