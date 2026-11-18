#!/usr/bin/env python3
"""Set up the AI Management Office for YOUR company (stdlib only).

    python3 scripts/init_company.py                 # interactive wizard
    python3 scripts/init_company.py --from-json company/profile.json --yes
    python3 scripts/init_company.py --name "Acme Co" --country India --currency INR \
        --product "AcmeApp: a notes app" --yes      # non-interactive
    python3 scripts/init_company.py --check         # is this repo configured?
    python3 scripts/init_company.py --defaults      # render the neutral, unconfigured text

It writes `company/profile.json` and renders the company-specific files from `templates/`:
CLAUDE.md, company/facts/*.md and records/sources.md. Edit the templates (not the rendered
files) if you want a change to survive a re-run. Existing files that differ are backed up to
`<file>.bak` before being overwritten.

Do NOT put secrets or identifiers (PAN, Aadhaar, bank, tax IDs, API keys) in any answer.
Those belong in `company/private/` (git-ignored) or in the source system.
"""
import argparse
import datetime
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFILE = os.path.join(ROOT, "company", "profile.json")

# template (relative to templates/) -> output (relative to ROOT)
RENDER = {
    "CLAUDE.md.tmpl": "CLAUDE.md",
    "sources.md.tmpl": "records/sources.md",
    "facts/README.md.tmpl": "company/facts/README.md",
    "facts/identity-legal.md.tmpl": "company/facts/identity-legal.md",
    "facts/products.md.tmpl": "company/facts/products.md",
    "facts/strategy.md.tmpl": "company/facts/strategy.md",
    "facts/financial-assumptions.md.tmpl": "company/facts/financial-assumptions.md",
    "facts/technical-architecture.md.tmpl": "company/facts/technical-architecture.md",
    "facts/governance-compliance.md.tmpl": "company/facts/governance-compliance.md",
    "facts/operating-policies.md.tmpl": "company/facts/operating-policies.md",
}

DEFAULT_PROFILE = {
    "company_name": "Your Company",
    "country": "India",
    "currency": "INR",
    "business_type": "",
    "description": "",
    "stage": "",
    "owner_title": "founder",
    "fiscal_year": "",
    "products": [],
}

# Things that must never be typed into the profile (it is rendered into tracked files).
SENSITIVE = [
    (re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"), "looks like a PAN"),
    (re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"), "looks like an Aadhaar/12-digit ID"),
    (re.compile(r"\b(sk|pk|ghp|gho|xox[bp])[-_][A-Za-z0-9_-]{16,}"), "looks like an API key or token"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "looks like a private key"),
    (re.compile(r"\b\d{9,18}\b"), "long digit run (account number?)"),
]


def clean(v):
    """One line, no table-breaking characters."""
    return re.sub(r"\s+", " ", str(v or "")).replace("|", "/").strip()


def check_sensitive(profile):
    problems = []
    blobs = [("company_name", profile["company_name"])] + [(k, v) for k, v in profile.items() if isinstance(v, str)]
    for p in profile.get("products", []):
        blobs += [("product name", p.get("name", "")), ("product description", p.get("description", ""))]
    for label, text in blobs:
        for rx, why in SENSITIVE:
            if rx.search(text or ""):
                problems.append("%s %s. Keep identifiers out of the profile." % (label, why))
    return problems


def normalise(raw):
    p = dict(DEFAULT_PROFILE)
    p.update({k: raw[k] for k in raw if k in DEFAULT_PROFILE and raw[k] not in (None, "")})
    for k in DEFAULT_PROFILE:
        if k != "products":
            p[k] = clean(p[k])
    p["currency"] = p["currency"].upper()
    prods = []
    for item in raw.get("products", []) or []:
        if isinstance(item, str):
            name, _, desc = item.partition(":")
            item = {"name": name, "description": desc}
        name, desc = clean(item.get("name")), clean(item.get("description"))
        if name:
            prods.append({"name": name, "description": desc})
    p["products"] = prods
    return p


def tokens(p, today, configured):
    """Everything a template can use. `configured` False renders neutral, clearly-unset text."""
    prods = p["products"]
    d = {
        "company_name": p["company_name"],
        "country": p["country"] or "TBD",
        "currency": p["currency"] or "TBD",
        "business_type": p["business_type"] or "TBD",
        "stage": p["stage"] or "TBD",
        "owner_title": p["owner_title"] or "founder",
        "fiscal_year": p["fiscal_year"] or "TBD",
        "today": today,
        "products_inline": ", ".join(x["name"] for x in prods) or "TBD",
        "repo_example": prods[0]["name"] if prods else "your products' repositories",
        "numbering_note": " (₹, with the Indian numbering convention of lakh and crore)" if p["currency"].upper() == "INR" else "",
    }
    bits = [b for b in (p["country"], p["business_type"]) if b]
    d["description_clause"] = (", a " + " ".join(bits) + " business") if (configured and bits) else ""
    d["description_block"] = ("**What the company does (founder-stated):** %s\n\n" % p["description"]) if p["description"] else ""
    src = "Setup wizard answer (%s)" % today
    d["mission"] = p["description"] or "TBD"
    d["mission_source"] = src if p["description"] else ""
    d["mission_verified"] = today if p["description"] else ""
    d["fiscal_source"] = src if p["fiscal_year"] else ""
    d["fiscal_verified"] = today if p["fiscal_year"] else ""
    rows, arch = [], []
    for x in prods or [{"name": "(your first product)", "description": ""}]:
        named = bool(prods)
        rows.append("| %s | TBD | %s | founder | TBD | %s | %s |" % (
            x["name"], x["description"] or "Details TBD", src if named else "", today if named else ""))
        arch.append("| %s | TBD | TBD | TBD | TBD | | |" % x["name"])
    d["product_rows"] = "\n".join(rows)
    d["architecture_rows"] = "\n".join(arch)
    return d


def render(profile, configured=True, today=None):
    """Return {output_path: text}. Pure function; used by tests/validate.py too."""
    today = today or datetime.date.today().isoformat()
    t = tokens(profile, today, configured)
    out = {}
    for tpl, dest in RENDER.items():
        with open(os.path.join(ROOT, "templates", tpl), encoding="utf-8") as f:
            text = f.read()
        for k, v in t.items():
            text = text.replace("{{" + k + "}}", v)
        left = re.findall(r"\{\{\w+\}\}", text)
        if left:
            raise SystemExit("Unresolved template token(s) in %s: %s" % (tpl, sorted(set(left))))
        out[dest] = text
    return out


PRIVATE_README = """# company/private

Sensitive records (registration numbers, tax IDs, bank details, contracts, cap table). **Git-ignored**: everything here except this README stays on your machine.

The agents are not meant to read or edit this folder through the shell; the guard asks before any read. Prefer leaving sensitive documents in their source system and referencing them by ID in `records/sources.md`.
"""


def ensure_private_readme():
    path = os.path.join(ROOT, "company", "private", "README.md")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(PRIVATE_README)


def ask(label, default="", required=False):
    suffix = " [%s]" % default if default else ""
    while True:
        try:
            v = input("%s%s: " % (label, suffix)).strip()
        except EOFError:
            v = ""
        v = v or default
        if v or not required:
            return v
        print("  This one is required.")


def wizard(existing):
    print("AI Management Office setup. Answers are written to company/profile.json and rendered into CLAUDE.md and company/facts/.")
    print("No secrets or IDs (PAN, Aadhaar, bank, tax numbers, keys). Press Enter to keep the value in [brackets].\n")
    e = normalise(existing) if existing else dict(DEFAULT_PROFILE)
    p = {}
    p["company_name"] = ask("Company name", "" if e["company_name"] == "Your Company" else e["company_name"], required=True)
    p["country"] = ask("Country / jurisdiction of operation", e["country"])
    p["currency"] = ask("Reporting currency (ISO code, e.g. INR, USD, EUR)", e["currency"]).upper()
    p["business_type"] = ask("What kind of business (e.g. SaaS, consulting, e-commerce, agency)", e["business_type"])
    p["description"] = ask("One or two sentences on what the company does and for whom", e["description"])
    p["stage"] = ask("Stage (idea, pre-revenue, early revenue, growing, established)", e["stage"])
    p["owner_title"] = ask("Who makes the final calls (founder, CEO, owner, managing partner)", e["owner_title"])
    p["fiscal_year"] = ask("Financial year (e.g. Apr-Mar, Jan-Dec)", e["fiscal_year"])
    products = list(e["products"])
    if products:
        print("Current products: " + ", ".join(x["name"] for x in products))
        if ask("Replace the product list? (y/N)", "n").lower().startswith("y"):
            products = []
    if not products:
        print("Products or services, one per line as `Name: short description`. Blank line to finish.")
        while True:
            line = ask("  product")
            if not line:
                break
            products.append(line)
    p["products"] = products
    return normalise(p)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from-json", help="read answers from a JSON file (same shape as company/profile.json)")
    ap.add_argument("--name"); ap.add_argument("--country"); ap.add_argument("--currency")
    ap.add_argument("--business-type"); ap.add_argument("--description"); ap.add_argument("--stage")
    ap.add_argument("--owner-title"); ap.add_argument("--fiscal-year")
    ap.add_argument("--product", action="append", default=[], help="`Name: description`; repeatable")
    ap.add_argument("--yes", action="store_true", help="do not ask before overwriting files")
    ap.add_argument("--dry-run", action="store_true", help="show what would change, write nothing")
    ap.add_argument("--defaults", action="store_true", help="render the neutral unconfigured text (no profile.json)")
    ap.add_argument("--check", action="store_true", help="exit 0 if configured, 1 if not")
    a = ap.parse_args()

    if a.check:
        ok = os.path.exists(PROFILE)
        print("Configured: company/profile.json found." if ok else "Not configured. Run: python3 scripts/init_company.py")
        return 0 if ok else 1

    existing = None
    if os.path.exists(PROFILE):
        existing = json.load(open(PROFILE, encoding="utf-8"))

    if a.defaults:
        profile, configured = normalise(DEFAULT_PROFILE), False
    else:
        raw = {}
        if a.from_json:
            raw = json.load(open(a.from_json, encoding="utf-8"))
        flags = {"company_name": a.name, "country": a.country, "currency": a.currency, "business_type": a.business_type,
                 "description": a.description, "stage": a.stage, "owner_title": a.owner_title, "fiscal_year": a.fiscal_year}
        raw.update({k: v for k, v in flags.items() if v})
        if a.product:
            raw["products"] = a.product
        if raw:
            profile = normalise({**(existing or {}), **raw})
        elif sys.stdin.isatty():
            profile = wizard(existing)
        else:
            sys.exit("No answers given and no terminal. Use flags or --from-json, or run in a terminal.")
        configured = profile["company_name"] != "Your Company"
        if not configured:
            sys.exit("A company name is required.")
        problems = check_sensitive(profile)
        if problems:
            sys.exit("Refusing to write the profile:\n  - " + "\n  - ".join(problems))
        if profile["country"].strip().lower() != "india":
            print("Note: the CS and CA specialists default to Indian law (GST, ROC/MCA, TDS). Read docs/localising.md before relying on them for %s." % profile["country"])

    outputs = render(profile, configured)
    changes = []
    for dest, text in outputs.items():
        path = os.path.join(ROOT, dest)
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if cur != text:
            changes.append((dest, path, cur is not None))
    print("%d file(s) would change%s." % (len(changes), "" if configured else " (neutral defaults)"))
    for dest, _, existed in changes:
        print("  %s %s" % ("overwrite" if existed else "create   ", dest))
    if a.dry_run:
        return 0
    if changes and not a.yes and sys.stdin.isatty():
        if input("Proceed? Changed files are backed up to <file>.bak (y/N): ").strip().lower() != "y":
            print("Nothing written.")
            return 1
    elif changes and not a.yes:
        sys.exit("Refusing to overwrite without --yes in a non-interactive run.")
    for dest, path, existed in changes:
        if existed:
            os.replace(path, path + ".bak")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(outputs[dest])
    ensure_private_readme()
    if configured and not a.defaults:
        with open(PROFILE, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print("Wrote company/profile.json")
    print("\nNext: open this folder in Claude Code, then read docs/setup.md (step 4: confirm facts).")
    print("Privacy: your configured copy now describes your company. Keep it in a PRIVATE repository; do not push it to the public template.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
