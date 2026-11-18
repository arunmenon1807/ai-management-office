#!/usr/bin/env python3
"""Record keeping helper (stdlib only). Records are markdown files with simple
'key: value' frontmatter under records/. Run from the repository root.

  records.py new <decision|action|risk|compliance> "<title>" [--dir DIR]
  records.py list [type]            list records with status
  records.py stale                  report overdue / expired / unverified items
  records.py status                 short summary (used by SessionStart hook)
  records.py check                  validate frontmatter of all records

Reports are snapshots: they carry as_of and valid_until and are NEVER treated as
current facts. 'stale' flags every report past valid_until and every record whose
review/verification date has passed.
"""
import datetime as dt
import json
import os
import re
import sys

ROOT = os.environ.get("RECORDS_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES = {
    "decision": ("decisions", "DEC", ["id", "title", "status", "created", "approved_by", "approved_on", "owner", "review_by", "supersedes"]),
    "action": ("actions", "ACT", ["id", "title", "status", "created", "owner", "due", "decision_ref"]),
    "risk": ("risks", "RSK", ["id", "title", "status", "created", "owner", "likelihood", "impact", "review_by"]),
    "compliance": ("compliance", "CMP", ["id", "title", "status", "created", "authority", "frequency", "due", "evidence_ref", "last_verified", "verified_via"]),
}
STATUSES = {
    "decision": {"proposed", "approved", "rejected", "superseded"},
    "action": {"open", "doing", "blocked", "done", "cancelled"},
    "risk": {"open", "mitigating", "accepted", "closed"},
    "compliance": {"unknown", "not_started", "on_track", "due_soon", "overdue", "filed", "not_applicable"},
}
CLOSED = {"done", "cancelled", "closed", "rejected", "superseded", "filed", "not_applicable"}
TODAY = dt.date.today()


def parse(path):
    meta = {}
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        return meta
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line and not line.startswith(" "):
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip().strip('"')
    return meta


def date(v):
    try:
        return dt.date.fromisoformat(v)
    except (ValueError, TypeError):
        return None


def files(kind):
    d = os.path.join(ROOT, "records", kind)
    if not os.path.isdir(d):
        return []
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith(".md") and f != "README.md")


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:50]


def cmd_new(argv):
    if len(argv) < 2 or argv[0] not in TYPES:
        sys.exit("usage: records.py new <%s> \"<title>\"" % "|".join(TYPES))
    kind, title = argv[0], argv[1]
    folder, prefix, fields = TYPES[kind]
    base = os.path.join(ROOT, "records", folder)
    if "--dir" in argv:
        base = argv[argv.index("--dir") + 1]
    os.makedirs(base, exist_ok=True)
    nums = [int(m.group(1)) for f in os.listdir(base) for m in [re.match(prefix + r"-(\d+)", f)] if m]
    rid = "%s-%04d" % (prefix, max(nums + [0]) + 1)
    default_status = {"decision": "proposed", "action": "open", "risk": "open", "compliance": "unknown"}[kind]
    lines = ["---"]
    for f in fields:
        val = {"id": rid, "title": '"%s"' % title, "status": default_status, "created": TODAY.isoformat()}.get(f, "")
        lines.append("%s: %s" % (f, val))
    lines += ["---", "", "## Context", "", "## Detail", "", "## Sources (IDs from records/sources.md)", ""]
    path = os.path.join(base, "%s-%s.md" % (rid, slug(title)))
    with open(path, "x", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print(path)


def cmd_list(argv):
    kinds = [argv[0]] if argv else list(TYPES)
    for k in kinds:
        for p in files(TYPES[k][0]):
            m = parse(p)
            print("%-9s %-9s %-12s %s" % (m.get("id", "?"), m.get("status", "?"), m.get("due") or m.get("review_by") or "-", m.get("title", "")))


def stale_items():
    out = []
    for k, (folder, _, _) in TYPES.items():
        for p in files(folder):
            m = parse(p)
            st = m.get("status", "")
            if st in CLOSED:
                continue
            for field, label in (("due", "past due"), ("review_by", "review overdue")):
                d = date(m.get(field))
                if d and d < TODAY:
                    out.append((m.get("id", p), "%s (%s %s)" % (m.get("title", ""), label, d)))
            if k == "compliance":
                lv = date(m.get("last_verified"))
                if lv is None:
                    out.append((m.get("id", p), "%s (never verified against the source system)" % m.get("title", "")))
                elif (TODAY - lv).days > 90:
                    out.append((m.get("id", p), "%s (last verified %s, >90 days)" % (m.get("title", ""), lv)))
    for p in files("reports"):
        m = parse(p)
        vu = date(m.get("valid_until"))
        if m.get("status") == "snapshot" and vu and vu < TODAY:
            out.append((os.path.basename(p), "report expired %s - treat as history, not current fact" % vu))
    return out


def cmd_stale(_):
    items = stale_items()
    for i, msg in items:
        print("STALE  %-14s %s" % (i, msg))
    if not items:
        print("No stale items.")


def office_name():
    try:
        with open(os.path.join(ROOT, "company", "profile.json"), encoding="utf-8") as f:
            return json.load(f)["company_name"] + " AI Management Office"
    except Exception:
        return "AI Management Office (not configured: run python3 scripts/init_company.py)"


def cmd_status(_):
    counts = []
    for k, (folder, _, _) in TYPES.items():
        n = sum(1 for p in files(folder) if parse(p).get("status") not in CLOSED)
        counts.append("%d open %s" % (n, folder))
    print(office_name() + " | " + ", ".join(counts) + " | %d stale item(s)." % len(stale_items()))
    print("Reminder: reports in records/reports are dated snapshots. Re-verify against source systems before relying on them.")


def cmd_check(_):
    bad = 0
    for k, (folder, _, fields) in TYPES.items():
        for p in files(folder):
            m = parse(p)
            for f in ("id", "title", "status"):
                if not m.get(f):
                    print("ERROR %s: missing %s" % (p, f)); bad += 1
            if m.get("status") and m["status"] not in STATUSES[k]:
                print("ERROR %s: invalid status %r" % (p, m["status"])); bad += 1
            if k == "decision" and m.get("status") == "approved" and not (m.get("approved_by") and date(m.get("approved_on"))):
                print("ERROR %s: approved decision needs approved_by and approved_on" % p); bad += 1
    for p in files("reports"):
        m = parse(p)
        for f in ("type", "as_of", "valid_until", "status"):
            if not m.get(f):
                print("ERROR %s: report missing %s" % (p, f)); bad += 1
    print("records check: %s" % ("FAILED (%d)" % bad if bad else "ok"))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    cmds = {"new": cmd_new, "list": cmd_list, "stale": cmd_stale, "status": cmd_status, "check": cmd_check}
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        sys.exit(__doc__)
    cmds[sys.argv[1]](sys.argv[2:])
