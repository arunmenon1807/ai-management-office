#!/usr/bin/env python3
"""PreToolUse guard for the AI Management Office.

Reads the hook payload on stdin, applies .claude/guard-policy.json and prints a
permission decision. Fails CLOSED: any internal error results in a deny.
Every non-read call and every non-allow decision is appended to logs/audit.jsonl.

Importable for tests: evaluate(payload, policy, root) -> (kind, reason).
"""
import hashlib
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
POLICY_PATH = os.path.join(HERE, "..", "guard-policy.json")
WRITE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}


def rx(p):
    return re.compile(p, re.I)


def first_match(rules, text):
    for r in rules:
        if rx(r["pattern"]).search(text):
            return r["reason"]
    return None


def written_content(inp):
    parts = [inp.get("content"), inp.get("new_string"), inp.get("new_source")]
    for e in inp.get("edits") or []:
        parts.append(e.get("new_string"))
    return "\n".join(p for p in parts if isinstance(p, str))


def rel_path(path, root):
    if not path:
        return None, False
    full = os.path.realpath(path if os.path.isabs(path) else os.path.join(root, path))
    root_real = os.path.realpath(root)
    if full == root_real or full.startswith(root_real + os.sep):
        return os.path.relpath(full, root_real), True
    return full, False


def evaluate(payload, policy, root):
    tool = payload.get("tool_name", "")
    inp = payload.get("tool_input") or {}

    if tool == "Bash":
        cmd = inp.get("command", "")
        reason = first_match(policy["bash_deny"], cmd)
        if reason:
            return "deny", reason
        reason = first_match(policy["secret_content_patterns"], cmd)
        if reason:
            return "deny", "Command appears to contain a secret/sensitive identifier: " + reason
        reason = first_match(policy["bash_ask"], cmd)
        if reason:
            return "ask", reason
        return "allow", ""

    if tool in WRITE_TOOLS:
        path = inp.get("file_path") or inp.get("notebook_path")
        content = written_content(inp)
        reason = first_match(policy["secret_content_patterns"], content)
        if reason:
            return "deny", "Refusing to write a secret/sensitive identifier (" + reason + "). Keep secrets out of Git."
        rel, inside = rel_path(path, root)
        if rel is None:
            return "deny", "No target path."
        if not inside:
            return "ask", "Write outside the project folder: " + rel
        reason = first_match(policy["write_deny_paths"], rel)
        if reason:
            return "deny", reason
        reason = first_match(policy["write_ask_paths"], rel)
        if reason:
            return "ask", reason
        return "allow", ""

    if tool in ("WebFetch", "WebSearch"):
        text = json.dumps(inp)
        reason = first_match(policy["secret_content_patterns"], text)
        if reason:
            return "deny", "Outbound request appears to contain a secret/sensitive identifier: " + reason
        return "allow", ""

    if tool.startswith("mcp__"):
        parts = tool.split("__")
        server = parts[1] if len(parts) > 2 else ""
        name = parts[-1]
        if any(rx(p).search(server) for p in policy["internal_server_patterns"]):
            return "allow", ""
        if any(rx(p).search(server) for p in policy["ask_server_patterns"]):
            return "ask", "Browser/desktop control can act on external systems. Confirm."
        dc = policy.get("drive_create")
        if dc and rx(dc["server_pattern"]).search(server) and rx(dc["name_pattern"]).search(name):
            reason = first_match(policy["secret_content_patterns"], json.dumps(inp, ensure_ascii=False))
            if reason:
                return "deny", "Drive file content appears to contain a secret/sensitive identifier: " + reason
            digest = hashlib.sha256(json.dumps(inp, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()
            if os.environ.get(dc["approval_env"]) == digest:
                return "allow", ""  # exact payload the founder approved in the app; the app allows it once
            if os.environ.get(dc["app_env"]):
                return "deny", ("Creating a Drive file needs the founder's approval. The app has queued this exact file for approval. "
                                "Do NOT retry or call it again. Tell the founder the file is waiting for their Approve click in this chat.")
            return "ask", "Creating a Drive file is an external write. Confirm with the founder."
        md = policy.get("mail_draft")
        if md and rx(md["server_pattern"]).search(server) and rx(md["name_pattern"]).search(name):
            # Drafts stay inside the founder's mailbox and are never sent by agents. Scan the content first.
            reason = first_match(policy["secret_content_patterns"], json.dumps(inp, ensure_ascii=False))
            if reason:
                return "deny", "Email draft appears to contain a secret/sensitive identifier: " + reason
            return "allow", ""
        if rx(policy["mcp_secret_name_pattern"]).search(name):
            return "deny", "Tool may expose credentials or secrets. View it yourself in the provider dashboard."
        if rx(policy["mcp_read_name_pattern"]).search(name):
            reason = first_match(policy["secret_content_patterns"], json.dumps(inp))
            if reason:
                return "deny", "Tool input appears to contain a secret/sensitive identifier: " + reason
            return "allow", ""
        return "deny", ("Non-read external tool '" + name + "' on server '" + server + "'. "
                        "The system is read-only; the founder performs external actions manually.")

    return "allow", ""


def summarize(payload):
    tool = payload.get("tool_name", "")
    inp = payload.get("tool_input") or {}
    if tool == "Bash":
        s = inp.get("command", "")
    elif tool in WRITE_TOOLS:
        s = inp.get("file_path") or inp.get("notebook_path") or ""
    else:
        s = json.dumps({k: v for k, v in inp.items() if isinstance(v, (str, int, bool))})
    return s[:300]


def audit(root, policy, payload, kind, reason):
    tool = payload.get("tool_name", "")
    if kind == "allow" and tool in policy.get("audit_skip_tools", []):
        return
    summary = summarize(payload)
    for r in policy["secret_content_patterns"]:
        summary = rx(r["pattern"]).sub("[REDACTED]", summary)
    try:
        os.makedirs(os.path.join(root, "logs"), exist_ok=True)
        with open(os.path.join(root, "logs", "audit.jsonl"), "a") as f:
            f.write(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "tool": tool,
                                "decision": kind, "reason": reason, "input": summary}) + "\n")
    except OSError:
        pass


def emit(kind, reason):
    if kind == "allow":
        return
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                             "permissionDecision": kind,
                                             "permissionDecisionReason": "[AIMO guard] " + reason}}))


def main():
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    try:
        payload = json.load(sys.stdin)
        with open(POLICY_PATH) as f:
            policy = json.load(f)
        kind, reason = evaluate(payload, policy, root)
        audit(root, policy, payload, kind, reason)
        emit(kind, reason)
    except Exception as exc:  # fail closed
        emit("deny", "Guard error (failing closed): %s" % exc)
    sys.exit(0)


if __name__ == "__main__":
    main()
