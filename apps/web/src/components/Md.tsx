"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function Md({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{children}</ReactMarkdown>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn !py-1 !px-2 text-xs" aria-label="Copy"
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? <Check size={12} /> : <Copy size={12} />}{done ? "Copied" : "Copy"}
    </button>
  );
}
