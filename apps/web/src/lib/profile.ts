import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths";

export type Profile = { company_name: string; country?: string; currency?: string; description?: string };

/** Company context written by `python3 scripts/init_company.py`. Falls back to a neutral name if not set up yet. */
export function loadProfile(): Profile {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(repoRoot(), "company", "profile.json"), "utf8"));
    if (p && typeof p.company_name === "string" && p.company_name.trim()) return p;
  } catch { /* not configured */ }
  return { company_name: "Your Company" };
}
