#!/usr/bin/env python3
"""Build atlas_researched_company_tasks.csv.gz from a hand-researched
company<->task xlsx workbook (e.g. hackerrank_company_task_dataset_*.xlsx),
one of possibly several community_dataset sources — see also
build_community_company_problems.py (dr-o-ne) and that module's docstring
for why seed_community_company_problems.py takes every such CSV together.

Input shape (the workbook's "Pairs_2022plus" sheet — every other sheet is
changelog/summary/methodology and is not read):
  company, task_name, task_summary, public_equivalent_url, source_url,
  interview_year, source_published_year, mode, evidence_type, confidence,
  notes, year_evidence, freshness_status

Each row is an individually cited, dated claim (a candidate report, an
interview-experience post, etc.) rather than a scrape — meaningfully more
auditable per-row than dr-o-ne's opaque frequency table. It is still a
single research pass rather than several independently maintained repos
though, so it stays in the same source_type = 'community_dataset' tier,
not the cross-validated 'dataset' one.

Only rows with a public_equivalent_url on a platform we already track
(leetcode.com, geeksforgeeks.org, hackerrank.com) are importable — a
company_problems row needs a resolvable problem, and roughly two-thirds of
this workbook's rows are prose-only descriptions of proprietary
company-authored tasks with no public equivalent (e.g. "Mango", "Keypad
Fun"). Those are skipped, not fabricated into synthetic catalog entries;
--report-skipped prints what got dropped and why for a future pass.

evidence_count encodes the per-row confidence/evidence_type columns the
CSV schema has no dedicated field for: base 1, +1 if confidence == 'High',
+1 if evidence_type == 'Cross-source' (independently corroborated) — so
1..3, never a stand-in for independent-source count the way the primary
LeetCode dataset's evidence_count is. last_seen is interview_year's July 1
(the sheet only records a year, not a date).

Company aliasing reuses the scheme build_company_problems.py/
seed_gfg_company_problems.py already share, plus two merges specific to
splits already present in the primary datasets (see README):
  "Twitter (X)"    -> existing "cmp_twitter" (111 rows beats "X"'s 51 —
                       same rule as Block -> Square: merge into whichever
                       existing code already carries more evidence)
  "JPMorgan Chase" -> existing "cmp_jpmorgan" (91 rows beats "J.P. Morgan"'s
                       79 — note "J.P. Morgan"/"JPMorgan" are themselves an
                       unresolved split in the primary dataset, out of
                       scope to fix here; see README)
Neither is added to build_company_problems.py's own ALIASES for the same
reason Block/Square wasn't: that would require rebuilding the primary CSV
from the four external repo clones.

Usage:
  build_researched_company_tasks.py --xlsx <path.xlsx> \
      --out atlas_researched_company_tasks.csv.gz
  build_researched_company_tasks.py --xlsx <path.xlsx> --out <out> --report-skipped
"""
import argparse
import csv
import gzip
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from datetime import date

SOURCE = "hackerrank_company_task_dataset_v7"
SHEET_NAME = "Pairs_2022plus"

ALIASES = {
    "facebook": "meta",
    "d e shaw": "de shaw",
    "twitter x": "twitter",
    "jpmorgan chase": "jpmorgan",
}

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

PLATFORM_PATTERNS = [
    ("leetcode", re.compile(r"leetcode\.com/problems/([a-z0-9-]+)")),
    # geeksforgeeks.org/problems/<slug>/<n> only: the practice catalog, same
    # shape as atlas_gfg_company_problems.csv.gz. geeksforgeeks.org/dsa/... and
    # other content-hub paths (e.g. /ethical-hacking/...) are educational
    # articles, not a practiceable problem — every GFG link in the v7 workbook
    # turned out to be one of those, so all 26 are skipped, not imported as
    # fake problems (see build_rows' skip accounting).
    ("geeksforgeeks", re.compile(r"geeksforgeeks\.org/problems/([a-z0-9-]+)")),
    ("hackerrank", re.compile(r"hackerrank\.com/challenges/([a-z0-9-]+)")),
]


def norm_key(raw):
    key = re.sub(r"[^a-z0-9]+", " ", raw.lower()).strip()
    return ALIASES.get(key, key)


def resolve_platform_slug(url):
    u = url.strip().lower()
    for platform, pattern in PLATFORM_PATTERNS:
        m = pattern.search(u)
        if m:
            return platform, m.group(1)
    return None, None


# --- minimal stdlib .xlsx reader (no openpyxl/pandas dependency in seeds/) ---

def _col_to_idx(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def _load_shared_strings(z):
    try:
        data = z.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(data)
    return ["".join((t.text or "") for t in si.findall(".//m:t", NS))
            for si in root.findall("m:si", NS)]


def _load_sheet_rows(z, sheet_path, shared):
    root = ET.fromstring(z.read(sheet_path))
    sheetdata = root.find("m:sheetData", NS)
    rows = []
    if sheetdata is None:
        return rows
    for row in sheetdata.findall("m:row", NS):
        cells = {}
        maxc = -1
        for c in row.findall("m:c", NS):
            ref = c.attrib.get("r", "")
            idx = _col_to_idx(ref) if ref else len(cells)
            maxc = max(maxc, idx)
            t = c.attrib.get("t")
            v = c.find("m:v", NS)
            is_ = c.find("m:is", NS)
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t in ("str", "n") and v is not None:
                val = v.text
            elif t == "inlineStr" and is_ is not None:
                val = "".join((x.text or "") for x in is_.findall(".//m:t", NS))
            elif v is not None:
                val = v.text
            else:
                val = None
            cells[idx] = val
        rows.append([cells.get(i) for i in range(maxc + 1)])
    return rows


def read_sheet_by_name(xlsx_path, sheet_name):
    z = zipfile.ZipFile(xlsx_path)
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rid_to_target = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
    r_ns = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"

    target = None
    for s in wb.find("m:sheets", NS):
        if s.attrib["name"] == sheet_name:
            target = rid_to_target[s.attrib[r_ns]]
            break
    if target is None:
        raise ValueError(f"sheet {sheet_name!r} not found in {xlsx_path}")

    shared = _load_shared_strings(z)
    return _load_sheet_rows(z, target.lstrip("/"), shared)


# --- xlsx -> staging rows -----------------------------------------------

def build_rows(xlsx_path):
    rows = read_sheet_by_name(xlsx_path, SHEET_NAME)
    header = rows[0]
    expected = ["company", "task_name", "task_summary", "public_equivalent_url",
                "source_url", "interview_year", "source_published_year", "mode",
                "evidence_type", "confidence", "notes", "year_evidence", "freshness_status"]
    if header != expected:
        raise ValueError(f"unexpected {SHEET_NAME} header: {header}")

    kept, skipped = [], []
    seen_pairs = set()
    for r in rows[1:]:
        (company, task_name, _summary, equiv_url, _source_url, interview_year,
         *_rest) = r
        confidence = r[9]
        evidence_type = r[8]

        if not equiv_url:
            skipped.append((company, task_name, "no public_equivalent_url"))
            continue
        platform, slug = resolve_platform_slug(equiv_url)
        if not platform:
            skipped.append((company, task_name, f"unrecognized platform: {equiv_url}"))
            continue

        key = norm_key(company)
        code = "cmp_" + re.sub(r"\s+", "_", key)
        pair = (platform, code, slug)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)

        evidence_count = 1 + (1 if confidence == "High" else 0) + \
            (1 if evidence_type == "Cross-source" else 0)
        last_seen = date(int(interview_year), 7, 1).isoformat()

        kept.append({
            "platform": platform,
            "code": code,
            "name": company,
            "slug": slug,
            "title": task_name,
            "difficulty": "",
            "evidence_count": evidence_count,
            "last_seen": last_seen,
            "url": equiv_url,
        })
    return kept, skipped


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--xlsx", required=True, help="path to the researched .xlsx workbook")
    parser.add_argument("--out", default="atlas_researched_company_tasks.csv.gz")
    parser.add_argument("--report-skipped", action="store_true",
                         help="print every row that had no importable public equivalent")
    args = parser.parse_args(argv or sys.argv[1:])

    kept, skipped = build_rows(args.xlsx)

    with gzip.open(args.out, "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["platform", "company_code", "company_name", "slug", "title", "difficulty",
                    "evidence_count", "last_seen", "sources", "problem_url"])
        for r in sorted(kept, key=lambda r: (r["platform"], r["code"], r["slug"])):
            w.writerow([r["platform"], r["code"], r["name"], r["slug"], r["title"],
                        r["difficulty"], r["evidence_count"], r["last_seen"], SOURCE, r["url"]])

    companies = len({r["code"] for r in kept})
    print(f"wrote {args.out}: {companies} companies, {len(kept)} pairs "
          f"({len(skipped)} rows skipped, no importable public equivalent)", file=sys.stderr)
    if args.report_skipped:
        for company, task, reason in skipped:
            print(f"skipped: {company} / {task} — {reason}", file=sys.stderr)


if __name__ == "__main__":
    main()
