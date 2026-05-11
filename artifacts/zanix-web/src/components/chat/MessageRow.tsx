import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Hash, Volume2, VolumeX, X, AlertCircle,
  Image as ImageIcon, Maximize2, File as FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ZanixLogo from "@/components/zanix-logo";
import { CopyBtn, CodeBlock } from "./CodeBlock";
import { InlineTrace } from "./InlineTrace";
import type { Message, TraceStep } from "./types";

// ─── Typing Dots ──────────────────────────────────────────────────
export function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gradient-to-br from-primary to-cyan-400 inline-block animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.7s" }}
        />
      ))}
    </div>
  );
}

// ─── Inline Image ─────────────────────────────────────────────────
function InlineImage({ src, alt }: { src: string; alt?: string }) {
  const [enlarged, setEnlarged] = useState(false);
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="my-3 rounded-2xl overflow-hidden border border-white/10 cursor-zoom-in max-w-full sm:max-w-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        onClick={() => setEnlarged(true)}
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border-b border-white/6">
          <ImageIcon className="w-3 h-3 text-primary" />
          <span className="text-[10px] text-white/40 font-medium">
            {alt || "صورة مُولَّدة بالذكاء الاصطناعي"}
          </span>
          <Maximize2 className="w-3 h-3 text-white/20 mr-auto" />
        </div>
        <img
          src={src}
          alt={alt || "AI generated"}
          className="w-full h-auto object-contain bg-white/5"
        />
      </motion.div>

      <AnimatePresence>
        {enlarged && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setEnlarged(false)}
          >
            <motion.img
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              src={src}
              alt={alt || "AI generated"}
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setEnlarged(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Message Row ──────────────────────────────────────────────────
export function MessageRow({
  msg,
  liveSteps,
  activeSseTaskId,
}: {
  msg: Message;
  liveSteps: TraceStep[];
  activeSseTaskId: string | null;
}) {
  const [speaking, setSpeaking] = useState(false);
  const isUser = msg.role === "user";

  const speak = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = msg.content.replace(/[#*`>_~[\]()]/g, "").slice(0, 4000);
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ar-SA";
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  const isThisLive = !!(msg.isStreaming && msg.taskId && msg.taskId === activeSseTaskId);
  const steps = isThisLive ? liveSteps : (msg.steps ?? []);
  const images = msg.attachments?.filter((a) => a.type === "image") ?? [];
  const files = msg.attachments?.filter((a) => a.type === "file") ?? [];

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end px-4 sm:px-8 py-1.5 group"
      >
        <div className="max-w-[80%] sm:max-w-[68%] flex flex-col items-end gap-1.5">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="w-32 h-28 sm:w-44 sm:h-36 rounded-2xl overflow-hidden border border-white/10 bg-white/4 shadow-lg"
                >
                  <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-xs text-white/55"
                >
                  <FileIcon className="w-3.5 h-3.5 text-white/35 shrink-0" />
                  <span className="max-w-[110px] truncate">{f.name}</span>
                </div>
              ))}
            </div>
          )}
          {msg.content && (
            <div className="bg-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white/88 leading-relaxed">
              <p dir="auto" className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          )}
          <span className="text-[10px] text-white/18 opacity-0 group-hover:opacity-100 transition-opacity pr-1 select-none">
            {msg.createdAt.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3 sm:gap-4 px-3 sm:px-6 py-3 group"
    >
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-primary/25 to-cyan-500/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_16px_hsl(260_84%_63%/0.18)]">
        <ZanixLogo size={16} />
      </div>

      <div className="flex-1 min-w-0 space-y-1 pb-1">
        {(isThisLive || steps.length > 0) && (
          <InlineTrace steps={steps} isLive={isThisLive} />
        )}

        {msg.isStreaming && !msg.content ? (
          <TypingDots />
        ) : msg.content ? (
          <div
            className={cn(
              "prose prose-sm max-w-none prose-invert",
              "text-[14px] leading-[1.78]",
              "[&>p]:text-white/82 [&>p]:mb-3 [&>p:last-child]:mb-0",
              "[&>ul]:text-white/78 [&>ul]:space-y-1 [&>ol]:text-white/78",
              "[&>ul>li]:text-white/78 [&>ol>li]:text-white/78",
              "[&>h1]:text-white/90 [&>h1]:font-bold [&>h1]:text-lg [&>h1]:mb-3 [&>h1]:mt-4",
              "[&>h2]:text-white/88 [&>h2]:font-semibold [&>h2]:text-base [&>h2]:mb-2 [&>h2]:mt-4",
              "[&>h3]:text-white/85 [&>h3]:font-semibold [&>h3]:text-sm [&>h3]:mb-2 [&>h3]:mt-3",
              "[&>hr]:border-white/8 [&>hr]:my-5"
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children }) {
                  if (className?.includes("language-"))
                    return <CodeBlock className={className}>{children}</CodeBlock>;
                  return (
                    <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[12px] font-mono text-cyan-300 border border-white/8">
                      {children}
                    </code>
                  );
                },
                img({ src, alt }) {
                  if (!src) return null;
                  return <InlineImage src={src} alt={alt} />;
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3 rounded-xl border border-white/8 not-prose">
                      <table className="border-collapse w-full text-xs">{children}</table>
                    </div>
                  );
                },
                th({ children }) {
                  return (
                    <th className="border-b border-white/10 px-4 py-2.5 bg-white/5 font-semibold text-white/80 text-right">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="border-b border-white/5 px-4 py-2 text-white/60 last:border-0 text-right">
                      {children}
                    </td>
                  );
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="not-prose border-r-2 border-primary/40 pr-4 text-white/50 italic my-3 mr-0">
                      {children}
                    </blockquote>
                  );
                },
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>
            {msg.isStreaming && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.55, repeat: 9999 }}
                className="inline-block w-[2px] h-[1.1em] bg-primary/80 mx-0.5 align-middle rounded-full"
              />
            )}
          </div>
        ) : null}

        {msg.error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-2 mt-2 px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/18 text-red-300 text-xs max-w-full"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span dir="auto">{msg.error}</span>
          </motion.div>
        )}

        <div className="flex items-center gap-1.5 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="text-[10px] text-white/20 select-none">
            {msg.createdAt.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {msg.content && <CopyBtn text={msg.content} />}
          {msg.content && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={speak}
              title={speaking ? "إيقاف القراءة" : "قراءة بصوت عالٍ"}
              className={cn(
                "p-1 rounded-lg transition-all",
                speaking
                  ? "text-primary bg-primary/10 border border-primary/20"
                  : "text-white/22 hover:text-white/65 hover:bg-white/8"
              )}
            >
              {speaking ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </motion.button>
          )}
          {msg.tokensUsed && (
            <span className="flex items-center gap-1 text-[10px] text-white/18">
              <Hash className="w-2.5 h-2.5" />
              {msg.tokensUsed.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
