import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Download, X, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Copy Button ──────────────────────────────────────────────────
export function CopyBtn({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1800);
      }}
      className={cn(
        "rounded-lg transition-all flex items-center gap-1",
        size === "xs" ? "p-1" : "p-1.5",
        ok
          ? "bg-emerald-500/15 text-emerald-400"
          : "text-white/30 hover:text-white/70 hover:bg-white/8"
      )}
    >
      {ok ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── HTML Preview Modal ───────────────────────────────────────────
export function HtmlPreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col"
        onClick={onClose}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-[hsl(228_22%_6%)] border-b border-white/8 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Play className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs font-semibold text-white/70">معاينة مباشرة</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors p-1.5 rounded-lg hover:bg-white/6"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={url}
            className="w-full h-full rounded-2xl border border-white/10 bg-white"
            sandbox="allow-scripts allow-same-origin"
            title="Code Preview"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Language icons ───────────────────────────────────────────────
const LANG_ICON: Record<string, string> = {
  python: "🐍", py: "🐍",
  javascript: "⚡", js: "⚡",
  typescript: "💙", ts: "💙",
  tsx: "⚛️", jsx: "⚛️",
  html: "🌐", css: "🎨", json: "📦", sql: "🗄️",
  bash: "🖥️", sh: "🖥️", shell: "🖥️",
  go: "🐹", rust: "🦀", java: "☕",
  cpp: "⚙️", c: "⚙️",
  markdown: "📝", md: "📝",
  yaml: "📋", yml: "📋", xml: "📄",
};

const LANG_EXT: Record<string, string> = {
  python: "py", javascript: "js", typescript: "ts",
  tsx: "tsx", jsx: "jsx", css: "css", json: "json",
  bash: "sh", shell: "sh", html: "html", sql: "sql",
  go: "go", rust: "rs", java: "java", cpp: "cpp", c: "c",
  markdown: "md", yaml: "yml",
};

// ─── Code Block ───────────────────────────────────────────────────
export function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [showPreview, setShowPreview] = useState(false);
  const lang = (className?.replace("language-", "") ?? "").toLowerCase();
  const code = String(children).replace(/\n$/, "");
  const lineCount = code.split("\n").length;
  const ext = LANG_EXT[lang] ?? lang;
  const icon = LANG_ICON[lang] ?? "📄";
  const filename = ext ? `code.${ext}` : "snippet";
  const isHtml =
    lang === "html" ||
    code.includes("<!DOCTYPE") ||
    code.includes("<html") ||
    code.includes("<!-- zanix-preview -->");

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="relative group/code my-4 rounded-2xl overflow-hidden border border-white/8 shadow-[0_4px_28px_rgba(0,0,0,0.35)] not-prose">
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.04] border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[15px] leading-none shrink-0">{icon}</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-semibold text-white/70 font-mono">{filename}</span>
              <span className="text-[10px] text-white/28 whitespace-nowrap">{lineCount} سطر</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {lang && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/6 border border-white/8 text-white/30 uppercase tracking-wide">
                {lang}
              </span>
            )}
            {isHtml && (
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/12 border border-primary/22 text-primary hover:bg-primary/20 transition-all text-[10px] font-bold"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>معاينة</span>
              </button>
            )}
            <button
              onClick={handleDownload}
              title="تحميل"
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white/28 hover:text-white/70 hover:bg-white/8 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <CopyBtn text={code} />
          </div>
        </div>
        <pre className="bg-[hsl(228_28%_2.5%)] p-4 overflow-x-auto text-[12.5px] leading-relaxed m-0">
          <code className={cn("font-mono text-white/78", className)}>{children}</code>
        </pre>
      </div>
      {showPreview && (
        <HtmlPreviewModal html={code} onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}
