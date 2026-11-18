# Community guide: GitHub Discussions

Use **Discussions** for questions, ideas and sharing how you set things up. Use **Issues** for bugs and concrete feature requests. Use a **private security advisory** for anything the guard should have blocked but didn't, or any data exposure.

| I want to... | Go to |
|---|---|
| Ask how to set up, connect a tool, or adapt an agent | Discussions → **Q&A** |
| Float an idea or a jurisdiction pack before building it | Discussions → **Ideas** |
| Show your (fictional or anonymised) setup, workflow or agent | Discussions → **Show and tell** |
| Report something broken | Issues → Bug report |
| Request a specific change | Issues → Feature request |
| Report a guard bypass or data exposure | Private security advisory (link on the New issue page) |

## Asking a good question
- Say what you ran and what you expected. Include `python3 --version`, `node -v` and `claude --version` if relevant.
- Paste the **last lines** of `python3 tests/validate.py` if setup or the guard is involved.
- Use fictional values ("Acme Co"). **Never post real company data**, secrets, tokens, tax or bank identifiers, or contents of your `company/` folders. Redact screenshots too.
- One question per thread, and mark the answer when you get one.

## Ground rules
Everyone follows the [Code of Conduct](../CODE_OF_CONDUCT.md). This project gives decision support, not legal, tax, audit or financial advice, so please do not post requests for that here. Statutory questions go to your own Company Secretary, Accountant or counsel.

## For maintainers: turning Discussions on
1. Repository → **Settings → General → Features** → tick **Discussions**.
2. In the Discussions tab, create categories named exactly **Q&A** (format: question/answer), **Ideas** (open-ended) and **Show and tell** (open-ended). Discussion forms in `.github/DISCUSSION_TEMPLATE/` attach to a category by its slug (`q-a`, `ideas`, `show-and-tell`).
3. Pin a welcome post that links to this page.
