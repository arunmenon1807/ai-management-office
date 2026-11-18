# Rulesets

Repository rulesets, kept as JSON so the protection is reproducible. They are **not** applied automatically. A maintainer applies them once, with the GitHub CLI, by sending each JSON file to the repository's `rulesets` API endpoint:

```bash
gh api repos/OWNER/REPO/rulesets --method POST --input .github/rulesets/protect-main.json
gh api repos/OWNER/REPO/rulesets --method POST --input .github/rulesets/protect-release-tags.json
```

- **Protect main:** no deleting or force-pushing `main`; changes go through a pull request with resolved review threads; the `validate` and `web` CI checks must pass. Repository admins can bypass, so a solo maintainer can still push directly.
- **Protect release tags:** `v*` tags cannot be deleted, moved or force-updated.

Check names must match the job names in `.github/workflows/validate.yml`. To change a rule, edit the JSON and update the ruleset in Settings → Rules.
