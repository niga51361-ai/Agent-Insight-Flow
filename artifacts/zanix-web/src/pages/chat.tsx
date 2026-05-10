import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Plus, MessageSquare, LogOut, Menu,
  Terminal, Search, BarChart3, FileText, Brain,
  ChevronDown, ChevronLeft, Copy, Check, Activity,
  Globe, Code2, AlertCircle, Layers,
  Lightbulb, Eye, Wrench, Zap, Atom, Key,
  Square, Sparkles,
  Paperclip, Mic, MicOff, X,
  Hash, Workflow, ChevronUp,
  Maximize2, Play, Image as ImageIcon,
  File as FileIcon, Download, Database,
  Settings, User, Puzzle, Cpu,
  ExternalLink, Shield, Bell,
  Palette, Sliders, Bot,
  Volume2, VolumeX,
} from "lucide-react";
import {
  useGetMe, useLogout, useCreateSession, useListSessions,
  useOrchestrateSync,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import ZanixLogo from "@/components/zanix-logo";

// ─── Types ─────────────────────────────────────────────────────────
interface TraceStep {
  stepIndex: number;
  type: string;
  thought?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  observation?: string;
  status: "pending" | "running" | "completed" | "failed";
  timestamp?: number;
  duration?: number;
}

interface Attachment {
  id: string;
  name: string;
  type: "image" | "file";
  dataUrl: string;
  mimeType: string;
  size: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  steps?: TraceStep[];
  isStreaming?: boolean;
  taskId?: string;
  tokensUsed?: number;
  subResults?: any[];
  error?: string;
  createdAt: Date;
}

const MODELS = [
  { id: "gpt-5.2",    label: "Zanix Max",   badge: "الأقوى",    dot: "bg-violet-400",   color: "text-violet-400" },
  { id: "gpt-5-nano", label: "Zanix Flash", badge: "الأسرع",    dot: "bg-cyan-400",     color: "text-cyan-400" },
  { id: "o4-mini",    label: "Zanix Think", badge: "استنتاج",   dot: "bg-amber-400",    color: "text-amber-400" },
];

// ─── Step meta ────────────────────────────────────────────────────
const STEP_META: Record<string, { icon: any; label: string; text: string; bg: string; border: string; glow: string; dot: string }> = {
  think:       { icon: Lightbulb, label: "تفكير",        text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   glow: "shadow-amber-500/20",  dot: "bg-amber-400" },
  search:      { icon: Search,    label: "بحث",           text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    glow: "shadow-blue-500/20",   dot: "bg-blue-400" },
  browse:      { icon: Globe,     label: "تصفح الويب",   text: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    glow: "shadow-cyan-500/20",   dot: "bg-cyan-400" },
  code:        { icon: Code2,     label: "كود",           text: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/25",  glow: "shadow-violet-500/20", dot: "bg-violet-400" },
  shell:       { icon: Terminal,  label: "طرفية",         text: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/25",  glow: "shadow-violet-500/20", dot: "bg-violet-400" },
  write_file:  { icon: FileText,  label: "كتابة ملف",    text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/20",dot: "bg-emerald-400" },
  read_file:   { icon: Eye,       label: "قراءة ملف",    text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/20",dot: "bg-emerald-400" },
  data:        { icon: BarChart3, label: "تحليل بيانات", text: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/25",    glow: "shadow-pink-500/20",   dot: "bg-pink-400" },
  done:        { icon: Check,     label: "اكتمل",         text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/20",dot: "bg-emerald-400" },
  tool:        { icon: Wrench,    label: "أداة",          text: "text-primary/80",  bg: "bg-primary/8",      border: "border-primary/20",     glow: "shadow-primary/20",    dot: "bg-primary" },
  memory:      { icon: Brain,     label: "ذاكرة",         text: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/25",    glow: "shadow-rose-500/20",   dot: "bg-rose-400" },
  image:       { icon: ImageIcon, label: "صورة",          text: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/25",  glow: "shadow-orange-500/20", dot: "bg-orange-400" },
};

function getStepMeta(type: string) {
  return STEP_META[type] ?? { icon: Wrench, label: type, text: "text-white/45", bg: "bg-white/5", border: "border-white/10", glow: "", dot: "bg-white/30" };
}

// ─── Live duration counter ────────────────────────────────────────
function LiveDuration({ startTs }: { startTs?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTs) return;
    const id = setInterval(() => setElapsed(Date.now() - startTs), 100);
    return () => clearInterval(id);
  }, [startTs]);
  const s = (elapsed / 1000).toFixed(1);
  return <span className="font-mono text-[9px] text-white/30">{s}s</span>;
}

function StaticDuration({ ms }: { ms?: number }) {
  if (!ms) return null;
  return <span className="font-mono text-[9px] text-white/25">{ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}</span>;
}

// ─── Copy button ─────────────────────────────────────────────────
function CopyBtn({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); }}
      className={cn(
        "rounded-lg transition-all flex items-center gap-1",
        size === "xs" ? "p-1" : "p-1.5",
        ok ? "bg-emerald-500/15 text-emerald-400" : "text-white/30 hover:text-white/70 hover:bg-white/8"
      )}
    >
      {ok ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Typing dots ─────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-gradient-to-br from-primary to-cyan-400 inline-block animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.7s" }} />
      ))}
    </div>
  );
}

// ─── Execution Trace ─────────────────────────────────────────────
function ExecutionTrace({ steps, isRunning, onClose }: { steps: TraceStep[]; isRunning: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [startTime] = useState(() => Date.now());
  const [totalElapsed, setTotalElapsed] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const completedCount = steps.filter(s => s.status === "completed").length;
  const failedCount    = steps.filter(s => s.status === "failed").length;
  const runningStep    = steps.find(s => s.status === "running");
  const progress       = steps.length > 0 ? (completedCount / steps.length) * 100 : isRunning ? 5 : 0;

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTotalElapsed(Date.now() - startTime), 200);
    return () => clearInterval(id);
  }, [isRunning, startTime]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps.length]);

  const totalDuration = totalElapsed > 0 ? totalElapsed : steps.reduce((a, s) => a + (s.duration ?? 0), 0);

  return (
    <div className="flex flex-col h-full bg-[hsl(228_22%_4%)]">

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-8 h-8 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/25 to-cyan-500/15 border border-primary/25 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
            {isRunning && (
              <motion.div className="absolute inset-0 rounded-xl border border-primary/40"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.6, repeat: 9999 }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white tracking-tight">مسار التنفيذ</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              {isRunning
                ? <span className="text-emerald-400/80 font-semibold">● مباشر</span>
                : steps.length > 0 ? "مكتمل" : "في الانتظار"}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white/60 hover:bg-white/6 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "الخطوات", value: steps.length, color: "text-white/60" },
            { label: "مكتملة",  value: completedCount, color: "text-emerald-400" },
            { label: "الوقت",   value: totalDuration > 0 ? `${(totalDuration / 1000).toFixed(1)}s` : "—", color: "text-cyan-400" },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <span className={cn("text-sm font-black tabular-nums", s.color)}>{s.value}</span>
              <span className="text-[9px] text-white/25 font-semibold uppercase tracking-wider mt-0.5">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", isRunning
              ? "bg-gradient-to-r from-primary via-cyan-400 to-primary bg-[length:200%_100%]"
              : failedCount > 0 ? "bg-gradient-to-r from-primary to-red-400" : "bg-gradient-to-r from-primary to-emerald-400"
            )}
            animate={{ width: `${isRunning ? Math.max(progress, 5) : steps.length > 0 ? 100 : 0}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0 scroll-smooth">

        {/* Empty state */}
        {steps.length === 0 && !isRunning && (
          <div className="flex flex-col items-center justify-center h-40 gap-4">
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: 9999, ease: "linear" }}
              className="w-10 h-10 rounded-2xl border border-white/8 flex items-center justify-center">
              <Atom className="w-5 h-5 text-white/10" />
            </motion.div>
            <p className="text-[11px] text-white/20 text-center">اضغط إرسال لبدء<br/>مسار التنفيذ</p>
          </div>
        )}

        {/* Thinking bootstrap */}
        {isRunning && steps.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-primary/6 border border-primary/18 mt-1">
            <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-primary/80">الوكيل يبدأ التفكير</p>
              <p className="text-[10px] text-white/25 mt-0.5">تحليل المهمة وتحديد الخطة…</p>
            </div>
          </motion.div>
        )}

        {/* Steps */}
        <AnimatePresence>
          {steps.map((step, i) => {
            const meta = getStepMeta(step.type);
            const Icon = meta.icon;
            const isExp = !!expanded[i];
            const isLive = step.status === "running";
            const isDone = step.status === "completed";
            const isFail = step.status === "failed";
            const hasDetail = !!(step.thought || step.toolName || step.toolInput || step.observation);
            const isLast = i === steps.length - 1;

            return (
              <motion.div key={`${i}-${step.stepIndex}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex gap-3 pb-0">
                  {/* ── Timeline rail ── */}
                  <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
                    {/* Node */}
                    <div className="relative">
                      {isLive && (
                        <motion.div className={cn("absolute inset-0 rounded-full", meta.border.replace("border-", "bg-").replace("/25", "/20"))}
                          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 1.4, repeat: 9999 }} />
                      )}
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center border-2 relative z-10 transition-all",
                        isLive ? cn(meta.bg, meta.border, "shadow-md", meta.glow) :
                        isDone ? "bg-emerald-500/15 border-emerald-500/40" :
                        isFail ? "bg-red-500/15 border-red-500/40" :
                        "bg-white/4 border-white/10"
                      )}>
                        {isLive
                          ? <div className={cn("w-2 h-2 rounded-full", meta.dot)} />
                          : isDone
                          ? <Check className="w-3 h-3 text-emerald-400" />
                          : isFail
                          ? <X className="w-3 h-3 text-red-400" />
                          : <span className="text-[9px] font-black text-white/20">{i + 1}</span>
                        }
                      </div>
                    </div>
                    {/* Connector */}
                    {!isLast && (
                      <motion.div
                        className={cn("w-px flex-1 min-h-[16px] mt-1", isDone ? "bg-emerald-500/20" : "bg-white/[0.06]")}
                        initial={{ scaleY: 0, originY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      />
                    )}
                  </div>

                  {/* ── Step card ── */}
                  <div className="flex-1 min-w-0 pb-3">
                    <button
                      onClick={() => hasDetail && setExpanded(p => ({ ...p, [i]: !p[i] }))}
                      className={cn(
                        "w-full text-right rounded-2xl border transition-all duration-200 overflow-hidden",
                        isLive
                          ? cn(meta.bg, meta.border, "shadow-sm", meta.glow, "shadow-sm")
                          : isDone ? "bg-white/[0.025] border-white/[0.07] hover:border-white/12"
                          : isFail ? "bg-red-500/5 border-red-500/15"
                          : "bg-white/[0.02] border-white/[0.05]",
                        hasDetail && "cursor-pointer"
                      )}
                    >
                      {/* Card top row */}
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border", meta.bg, meta.border)}>
                          <Icon className={cn("w-3 h-3", meta.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn("text-[10px] font-black uppercase tracking-wider leading-none", isLive ? meta.text : isDone ? "text-white/55" : isFail ? "text-red-400/70" : "text-white/30")}>
                              {meta.label}{step.toolName && step.toolName !== step.type ? ` · ${step.toolName}` : ""}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isLive && step.timestamp ? <LiveDuration startTs={step.timestamp} /> : <StaticDuration ms={step.duration} />}
                              {isLive && <motion.div className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: 9999 }} />}
                              {isDone && <Check className="w-3 h-3 text-emerald-400/60" />}
                              {isFail && <X className="w-3 h-3 text-red-400/60" />}
                              {hasDetail && <ChevronDown className={cn("w-3 h-3 text-white/20 transition-transform duration-200", isExp && "rotate-180")} />}
                            </div>
                          </div>
                          {(step.thought || step.toolName) && (
                            <p className={cn("text-[10px] mt-1 leading-relaxed line-clamp-2", isLive ? "text-white/60" : "text-white/35")} dir="auto">
                              {step.thought?.slice(0, 100) ?? step.toolName}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExp && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                            transition={{ duration: 0.22, ease: "easeInOut" }} className="overflow-hidden">
                            <div className="border-t border-white/[0.06] mx-0">
                              <div className="p-3 space-y-3">

                                {/* Thought */}
                                {step.thought && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <Lightbulb className="w-3 h-3 text-amber-400/60" />
                                      <span className="text-[9px] font-black uppercase tracking-widest text-white/25">تفكير الوكيل</span>
                                    </div>
                                    <p className="text-[11px] text-white/50 italic leading-relaxed bg-amber-500/4 border border-amber-500/10 rounded-xl p-2.5" dir="auto">
                                      {step.thought}
                                    </p>
                                  </div>
                                )}

                                {/* Tool + Input */}
                                {step.toolName && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <Wrench className="w-3 h-3 text-violet-400/60" />
                                      <span className="text-[9px] font-black uppercase tracking-widest text-white/25">الأداة</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-[10px] font-bold text-violet-300 bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/20">
                                        {step.toolName}
                                      </span>
                                    </div>
                                    {step.toolInput && Object.keys(step.toolInput).length > 0 && (
                                      <div className="mt-2 relative group">
                                        <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                          <CopyBtn text={JSON.stringify(step.toolInput, null, 2)} size="xs" />
                                        </div>
                                        <pre className="text-[9px] font-mono text-white/40 bg-black/40 border border-white/6 rounded-xl p-2.5 overflow-x-auto max-h-28 leading-relaxed">
                                          {JSON.stringify(step.toolInput, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Observation */}
                                {step.observation && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <Zap className="w-3 h-3 text-cyan-400/60" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white/25">النتيجة</span>
                                      </div>
                                      <CopyBtn text={step.observation} size="xs" />
                                    </div>
                                    <p className="text-[10px] text-white/45 leading-relaxed bg-cyan-500/4 border border-cyan-500/10 rounded-xl p-2.5 max-h-36 overflow-y-auto" dir="auto">
                                      {step.observation}
                                    </p>
                                  </div>
                                )}

                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Next step pending */}
        {isRunning && steps.length > 0 && !runningStep && (
          <div className="flex gap-3 items-center pr-1">
            <div className="w-7 flex justify-center shrink-0">
              <motion.div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/30"
                animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.9, repeat: 9999 }} />
            </div>
            <div className="flex-1 py-2 px-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2">
                {[0,1,2].map(j => (
                  <motion.div key={j} className="w-1 h-1 rounded-full bg-primary/40"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.6, delay: j * 0.15, repeat: 9999 }} />
                ))}
                <span className="text-[10px] text-white/25 mr-1">الخطوة التالية…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── Footer stats (only when done) ── */}
      {!isRunning && steps.length > 0 && (
        <div className="shrink-0 px-4 py-3 border-t border-white/[0.05] bg-white/[0.015]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {completedCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400/70 font-semibold">
                  <Check className="w-3 h-3" />{completedCount} مكتملة
                </span>
              )}
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-red-400/70 font-semibold">
                  <X className="w-3 h-3" />{failedCount} فشلت
                </span>
              )}
            </div>
            {totalDuration > 0 && (
              <span className="text-[10px] text-white/20 font-mono">
                {(totalDuration / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HTML Preview Modal ───────────────────────────────────────────
function HtmlPreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col"
        onClick={onClose}
      >
        <div className="flex items-center justify-between px-4 py-2.5 bg-[hsl(228_22%_6%)] border-b border-white/8 shrink-0" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Play className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs font-semibold text-white/70">معاينة مباشرة</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1.5 rounded-lg hover:bg-white/6">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 p-3 sm:p-4" onClick={e => e.stopPropagation()}>
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

// ─── Code block — professional file card ────────────────────────
const LANG_ICON: Record<string, string> = {
  python: "🐍", py: "🐍",
  javascript: "⚡", js: "⚡",
  typescript: "💙", ts: "💙",
  tsx: "⚛️", jsx: "⚛️",
  html: "🌐",
  css: "🎨",
  json: "📦",
  sql: "🗄️",
  bash: "🖥️", sh: "🖥️", shell: "🖥️",
  go: "🐹",
  rust: "🦀",
  java: "☕",
  cpp: "⚙️", c: "⚙️",
  markdown: "📝", md: "📝",
  yaml: "📋", yml: "📋",
  xml: "📄",
};

const LANG_EXT: Record<string, string> = {
  python: "py", javascript: "js", typescript: "ts",
  tsx: "tsx", jsx: "jsx", css: "css", json: "json",
  bash: "sh", shell: "sh", html: "html", sql: "sql",
  go: "go", rust: "rs", java: "java", cpp: "cpp", c: "c",
  markdown: "md", yaml: "yml",
};

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [showPreview, setShowPreview] = useState(false);
  const lang = (className?.replace("language-", "") ?? "").toLowerCase();
  const code = String(children).replace(/\n$/, "");
  const lineCount = code.split("\n").length;
  const ext = LANG_EXT[lang] ?? lang;
  const icon = LANG_ICON[lang] ?? "📄";
  const filename = ext ? `code.${ext}` : "snippet";
  const isHtml = lang === "html" || code.includes("<!DOCTYPE") || code.includes("<html") || code.includes("<!-- zanix-preview -->");

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="relative group/code my-4 rounded-2xl overflow-hidden border border-white/8 shadow-[0_4px_28px_rgba(0,0,0,0.35)] not-prose">
        {/* File header */}
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
              <button onClick={() => setShowPreview(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/12 border border-primary/22 text-primary hover:bg-primary/20 transition-all text-[10px] font-bold">
                <Play className="w-3 h-3 fill-current" />
                <span>معاينة</span>
              </button>
            )}
            <button onClick={handleDownload} title="تحميل"
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white/28 hover:text-white/70 hover:bg-white/8 transition-all">
              <Download className="w-3.5 h-3.5" />
            </button>
            <CopyBtn text={code} />
          </div>
        </div>
        {/* Code body */}
        <pre className="bg-[hsl(228_28%_2.5%)] p-4 overflow-x-auto text-[12.5px] leading-relaxed m-0">
          <code className={cn("font-mono text-white/78", className)}>{children}</code>
        </pre>
      </div>
      {showPreview && <HtmlPreviewModal html={code} onClose={() => setShowPreview(false)} />}
    </>
  );
}

// ─── Attachment preview chip ──────────────────────────────────────
function AttachChip({ att, onRemove }: { att: Attachment; onRemove?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.88, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 4 }} transition={{ duration: 0.18 }}
      className="relative group/chip shrink-0">
      {att.type === "image" ? (
        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/12 bg-white/5">
          <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
          {onRemove && (
            <button onClick={onRemove}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 border border-white/20 flex items-center justify-center opacity-0 group-hover/chip:opacity-100 transition-opacity">
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 max-w-[140px]">
          <FileIcon className="w-3.5 h-3.5 text-white/40 shrink-0" />
          <span className="text-[10px] text-white/50 truncate">{att.name}</span>
          {onRemove && (
            <button onClick={onRemove} className="text-white/25 hover:text-white/70 transition-colors shrink-0 ml-0.5">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Inline Trace — single step row ─────────────────────────────
function InlineStepRow({ step, idx }: { step: TraceStep; idx: number }) {
  const [open, setOpen] = useState(false);
  const meta = getStepMeta(step.type);
  const Icon = meta.icon;
  const isRun  = step.status === "running";
  const isDone = step.status === "completed";
  const isFail = step.status === "failed";
  const hasDetail = !!(step.thought || step.toolInput || step.observation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: idx * 0.035 }}
      className="relative"
    >
      <button
        onClick={() => hasDetail && setOpen(p => !p)}
        disabled={!hasDetail}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-right group/step",
          isRun  ? cn(meta.bg, "border", meta.border, "shadow-sm") :
          isDone ? "hover:bg-white/[0.025]" :
          isFail ? "hover:bg-red-500/5" : "hover:bg-white/[0.02]",
          !hasDetail && "cursor-default"
        )}
      >
        {/* Status node */}
        <div className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all",
          isDone ? "bg-emerald-500/12 border-emerald-500/30" :
          isFail ? "bg-red-500/12 border-red-500/30" :
          isRun  ? cn(meta.bg, meta.border) :
                   "bg-white/[0.04] border-white/10"
        )}>
          {isDone ? <Check className="w-2.5 h-2.5 text-emerald-400" /> :
           isFail ? <X    className="w-2.5 h-2.5 text-red-400" /> :
           isRun  ? <motion.div className={cn("w-2 h-2 rounded-full", meta.dot)}
                      animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.7, repeat: 9999 }} /> :
                    <Icon className={cn("w-2.5 h-2.5", meta.text)} />}
        </div>

        {/* Step info */}
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <span className={cn(
            "text-[11px] font-semibold",
            isRun  ? meta.text :
            isDone ? "text-white/55" :
            isFail ? "text-red-400/70" : "text-white/30"
          )}>{meta.label}</span>
          {step.toolName && (
            <span className="hidden sm:block text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/6 text-white/25 truncate max-w-[130px]">
              {step.toolName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isRun ? <LiveDuration startTs={step.timestamp} /> : <StaticDuration ms={step.duration} />}
          {hasDetail && (
            <ChevronDown className={cn(
              "w-3 h-3 text-white/15 transition-transform duration-200 opacity-0 group-hover/step:opacity-100",
              open && "rotate-180"
            )} />
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden mx-3 mb-1 mt-0.5">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] overflow-hidden divide-y divide-white/[0.05]">
              {step.thought && (
                <div className="px-3 py-2.5">
                  <p className="text-[9px] text-amber-400/50 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Lightbulb className="w-2.5 h-2.5" /> تفكير
                  </p>
                  <p className="text-[11px] text-white/45 leading-relaxed italic">{step.thought}</p>
                </div>
              )}
              {step.toolInput && Object.keys(step.toolInput).length > 0 && (
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] text-violet-400/50 font-black uppercase tracking-widest flex items-center gap-1">
                      <Wrench className="w-2.5 h-2.5" /> المدخلات
                    </p>
                    <CopyBtn text={JSON.stringify(step.toolInput, null, 2)} size="xs" />
                  </div>
                  <pre className="text-[10px] font-mono text-white/38 overflow-x-auto leading-relaxed max-h-24 whitespace-pre-wrap">
                    {JSON.stringify(step.toolInput, null, 2)}
                  </pre>
                </div>
              )}
              {step.observation && (
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] text-cyan-400/50 font-black uppercase tracking-widest flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5" /> النتيجة
                    </p>
                    <CopyBtn text={step.observation} size="xs" />
                  </div>
                  <p className="text-[11px] text-white/42 leading-relaxed overflow-y-auto max-h-28 whitespace-pre-wrap">
                    {step.observation.slice(0, 800)}{step.observation.length > 800 ? "…" : ""}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Inline Trace — professional glass container (Apex-style) ────
function InlineTrace({ steps, isLive }: { steps: TraceStep[]; isLive: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const runningStep    = steps.find(s => s.status === "running");
  const completedCount = steps.filter(s => s.status === "completed").length;
  const failedCount    = steps.filter(s => s.status === "failed").length;
  const totalDuration  = steps.reduce((acc, s) => acc + (s.duration ?? 0), 0);
  const [liveMs, setLiveMs]    = useState(0);
  const startRef               = useRef(Date.now());

  useEffect(() => {
    if (!isLive) return;
    startRef.current = Date.now();
    const id = setInterval(() => setLiveMs(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [isLive]);

  useEffect(() => {
    if (!isLive && steps.length > 0) setExpanded(false);
  }, [isLive]);

  if (steps.length === 0 && !isLive) return null;

  const displayMs = isLive ? liveMs : totalDuration;

  return (
    <div className={cn(
      "mb-3 rounded-2xl border overflow-hidden transition-all",
      isLive
        ? "border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent shadow-[0_0_20px_hsl(260_84%_63%/0.06)]"
        : "border-white/[0.07] bg-white/[0.016]"
    )}>
      {/* ── Header button ── */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-all hover:bg-white/[0.02] text-right"
      >
        {/* Status icon */}
        <div className={cn(
          "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all",
          isLive   ? "bg-primary/15 border-primary/28 shadow-[0_0_10px_hsl(260_84%_63%/0.2)]" :
          failedCount > 0 ? "bg-red-500/12 border-red-500/25" :
          "bg-emerald-500/12 border-emerald-500/25"
        )}>
          {isLive ? (
            <motion.div
              className="w-3.5 h-3.5 border-[1.5px] border-primary/25 border-t-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.75, repeat: 9999, ease: "linear" }}
            />
          ) : failedCount > 0 ? (
            <AlertCircle className="w-3 h-3 text-red-400" />
          ) : (
            <Check className="w-3 h-3 text-emerald-400" />
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          {isLive && runningStep ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-primary/85">
                {getStepMeta(runningStep.type).label}
              </span>
              {runningStep.toolName && (
                <span className="hidden sm:block text-[10px] font-mono text-white/22 truncate max-w-[100px]">
                  {runningStep.toolName}
                </span>
              )}
              <div className="flex gap-0.5">
                {[0,1,2].map(j => (
                  <motion.div key={j} className="w-1 h-1 rounded-full bg-primary/45"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 0.85, delay: j * 0.18, repeat: 9999 }} />
                ))}
              </div>
            </div>
          ) : isLive ? (
            <span className="text-[11px] font-semibold text-primary/55">يحلّل الطلب…</span>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-white/45">
                {steps.length} {steps.length === 1 ? "خطوة" : "خطوات"}
              </span>
              {completedCount > 0 && (
                <span className="text-[10px] font-bold text-emerald-400/60 flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" />{completedCount}
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-[10px] font-bold text-red-400/60 flex items-center gap-0.5">
                  <X className="w-2.5 h-2.5" />{failedCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: duration + step dots + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {displayMs > 0 && (
            <span className="font-mono text-[9px] text-white/22 tabular-nums">
              {(displayMs / 1000).toFixed(isLive ? 1 : 2)}s
            </span>
          )}
          {!isLive && steps.length > 1 && (
            <div className="hidden sm:flex gap-[3px] items-center">
              {steps.slice(0, 10).map((s, i) => (
                <div key={i} className={cn(
                  "rounded-full transition-all",
                  s.status === "completed" ? "w-1.5 h-1.5 bg-emerald-500/55" :
                  s.status === "failed"    ? "w-1.5 h-1.5 bg-red-500/55" :
                  s.status === "running"   ? "w-1.5 h-1.5 bg-primary/60" :
                                             "w-1 h-1 bg-white/12"
                )} />
              ))}
              {steps.length > 10 && (
                <span className="text-[8px] text-white/18 mr-0.5">+{steps.length - 10}</span>
              )}
            </div>
          )}
          <ChevronDown className={cn(
            "w-3.5 h-3.5 text-white/22 transition-transform duration-200",
            expanded && "rotate-180"
          )} />
        </div>
      </button>

      {/* ── Live progress bar ── */}
      {isLive && (
        <div className="h-[2px] bg-white/[0.04] mx-3.5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 via-cyan-400/80 to-primary/70"
            initial={{ width: "0%", backgroundPosition: "0% 0%" }}
            animate={{ width: "82%", backgroundPosition: "200% 0%" }}
            transition={{ width: { duration: 4, ease: [0.22, 1, 0.36, 1] }, backgroundPosition: { duration: 1.8, repeat: 9999, ease: "linear" } }}
          />
        </div>
      )}

      {/* ── Step list ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 pt-1.5 space-y-0.5">
              {steps.map((step, idx) => (
                <InlineStepRow key={step.stepIndex} step={step} idx={idx} />
              ))}
              {isLive && !runningStep && steps.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3">
                  {[0,1,2].map(j => (
                    <motion.div key={j} className="w-1.5 h-1.5 rounded-full bg-primary/35"
                      animate={{ scale: [1, 1.45, 1] }}
                      transition={{ duration: 0.65, delay: j * 0.15, repeat: 9999 }} />
                  ))}
                  <span className="text-[11px] text-white/22">تحليل الطلب…</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Message Row — Claude-style, no bubbles ───────────────────────
function MessageRow({ msg, liveSteps, activeSseTaskId }: {
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
    const text = msg.content.replace(/[#*`>_~\[\]()]/g, "").slice(0, 4000);
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ar-SA";
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.onend  = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };
  const isThisLive = !!(msg.isStreaming && msg.taskId && msg.taskId === activeSseTaskId);
  const steps      = isThisLive ? liveSteps : (msg.steps ?? []);
  const images     = msg.attachments?.filter(a => a.type === "image") ?? [];
  const files      = msg.attachments?.filter(a => a.type === "file")  ?? [];

  // ── User message ──
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end px-4 sm:px-8 py-1.5 group"
      >
        <div className="max-w-[80%] sm:max-w-[68%] flex flex-col items-end gap-1.5">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {images.map(img => (
                <div key={img.id} className="w-32 h-28 sm:w-44 sm:h-36 rounded-2xl overflow-hidden border border-white/10 bg-white/4 shadow-lg">
                  <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-xs text-white/55">
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

  // ── Assistant message ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3 sm:gap-4 px-3 sm:px-6 py-3 group"
    >
      {/* Avatar */}
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-primary/25 to-cyan-500/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_16px_hsl(260_84%_63%/0.18)]">
        <ZanixLogo size={16} />
      </div>

      {/* Content — free-flowing, no box */}
      <div className="flex-1 min-w-0 space-y-1 pb-1">

        {/* Inline trace (Manus-style) */}
        {(isThisLive || steps.length > 0) && (
          <InlineTrace steps={steps} isLive={isThisLive} />
        )}

        {/* Message text */}
        {msg.isStreaming && !msg.content ? (
          <TypingDots />
        ) : msg.content ? (
          <div className={cn(
            "prose prose-sm max-w-none prose-invert",
            "text-[14px] leading-[1.78]",
            "[&>p]:text-white/82 [&>p]:mb-3 [&>p:last-child]:mb-0",
            "[&>ul]:text-white/78 [&>ul]:space-y-1 [&>ol]:text-white/78",
            "[&>ul>li]:text-white/78 [&>ol>li]:text-white/78",
            "[&>h1]:text-white/90 [&>h1]:font-bold [&>h1]:text-lg [&>h1]:mb-3 [&>h1]:mt-4",
            "[&>h2]:text-white/88 [&>h2]:font-semibold [&>h2]:text-base [&>h2]:mb-2 [&>h2]:mt-4",
            "[&>h3]:text-white/85 [&>h3]:font-semibold [&>h3]:text-sm [&>h3]:mb-2 [&>h3]:mt-3",
            "[&>hr]:border-white/8 [&>hr]:my-5",
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children }) {
                  if (className?.includes("language-")) return <CodeBlock className={className}>{children}</CodeBlock>;
                  return <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[12px] font-mono text-cyan-300 border border-white/8">{children}</code>;
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
                th({ children }) { return <th className="border-b border-white/10 px-4 py-2.5 bg-white/5 font-semibold text-white/80 text-right">{children}</th>; },
                td({ children }) { return <td className="border-b border-white/5 px-4 py-2 text-white/60 last:border-0 text-right">{children}</td>; },
                blockquote({ children }) {
                  return <blockquote className="not-prose border-r-2 border-primary/40 pr-4 text-white/50 italic my-3 mr-0">{children}</blockquote>;
                },
                a({ href, children }) {
                  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">{children}</a>;
                },
              }}
            >{msg.content}</ReactMarkdown>
            {msg.isStreaming && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.55, repeat: 9999 }}
                className="inline-block w-[2px] h-[1.1em] bg-primary/80 mx-0.5 align-middle rounded-full"
              />
            )}
          </div>
        ) : null}

        {/* Error state */}
        {msg.error && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-2 mt-2 px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/18 text-red-300 text-xs max-w-full">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span dir="auto">{msg.error}</span>
          </motion.div>
        )}

        {/* Footer: time · copy · voice · tokens */}
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
              {speaking
                ? <VolumeX className="w-3 h-3" />
                : <Volume2 className="w-3 h-3" />
              }
            </motion.button>
          )}
          {msg.tokensUsed && (
            <span className="flex items-center gap-1 text-[10px] text-white/18">
              <Hash className="w-2.5 h-2.5" />{msg.tokensUsed.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Inline image from agent ──────────────────────────────────────
function InlineImage({ src, alt }: { src: string; alt?: string }) {
  const [enlarged, setEnlarged] = useState(false);
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="my-3 rounded-2xl overflow-hidden border border-white/10 cursor-zoom-in max-w-full sm:max-w-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        onClick={() => setEnlarged(true)}
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border-b border-white/6">
          <ImageIcon className="w-3 h-3 text-primary" />
          <span className="text-[10px] text-white/40 font-medium">{alt || "صورة مُولَّدة بالذكاء الاصطناعي"}</span>
          <Maximize2 className="w-3 h-3 text-white/20 mr-auto" />
        </div>
        <img src={src} alt={alt || "AI generated"} className="w-full h-auto object-contain bg-white/5" />
      </motion.div>
      <AnimatePresence>
        {enlarged && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setEnlarged(false)}>
            <motion.img
              initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
              src={src} alt={alt || "AI generated"}
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
              onClick={e => e.stopPropagation()}
            />
            <button onClick={() => setEnlarged(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────
function SessionItem({ session, isActive, onClick }: { session: any; isActive: boolean; onClick: () => void }) {
  return (
    <motion.button whileHover={{ x: -2 }} onClick={onClick}
      className={cn(
        "w-full text-right flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group border",
        isActive ? "bg-primary/10 border-primary/20 text-white" : "border-transparent text-white/40 hover:text-white/70 hover:bg-white/4"
      )}>
      <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-white/20 group-hover:text-white/40")} />
      <span className="text-xs font-medium truncate flex-1">{session.title || "محادثة جديدة"}</span>
      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
    </motion.button>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────
const SETTINGS_TABS = [
  { id: "profile",      label: "الملف الشخصي",  icon: User },
  { id: "models",       label: "النماذج",        icon: Cpu },
  { id: "integrations", label: "التكاملات",      icon: Puzzle },
  { id: "tools",        label: "الأدوات",        icon: Sliders },
  { id: "appearance",   label: "المظهر",         icon: Palette },
  { id: "notifications",label: "الإشعارات",     icon: Bell },
  { id: "security",     label: "الأمان",         icon: Shield },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

function SettingsPanel({ user, onClose, onLogout }: { user: any; onClose: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const INTEGRATIONS_LIST = [
    { name: "OpenAI",     icon: "🤖", desc: "نماذج GPT وDALL-E",            status: "متصل",    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { name: "Serper",     icon: "🔍", desc: "بحث ويب في الوقت الفعلي",     status: "متصل",    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { name: "GitHub",     icon: "🐙", desc: "إدارة المستودعات والكود",      status: "غير متصل", color: "text-white/30 bg-white/4 border-white/8" },
    { name: "Notion",     icon: "📝", desc: "قواعد المعرفة والملاحظات",    status: "غير متصل", color: "text-white/30 bg-white/4 border-white/8" },
    { name: "Slack",      icon: "💬", desc: "إرسال رسائل وإشعارات",        status: "غير متصل", color: "text-white/30 bg-white/4 border-white/8" },
    { name: "Google",     icon: "📊", desc: "Sheets, Drive, Docs",           status: "غير متصل", color: "text-white/30 bg-white/4 border-white/8" },
    { name: "PostgreSQL", icon: "🗄️", desc: "قاعدة بيانات متصلة",          status: "متصل",    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { name: "Stripe",     icon: "💳", desc: "معالجة المدفوعات",            status: "غير متصل", color: "text-white/30 bg-white/4 border-white/8" },
  ];

  const TOOLS_LIST = [
    { name: "webSearch",      label: "بحث الويب",          icon: "🌐", active: true,  desc: "يبحث في الإنترنت عبر Serper API" },
    { name: "webBrowse",      label: "تصفح الصفحات",       icon: "🔗", active: true,  desc: "يفتح ويقرأ محتوى المواقع" },
    { name: "codeRunner",     label: "تشغيل الكود",         icon: "⚡", active: true,  desc: "ينفّذ Python وJS في sandbox آمن" },
    { name: "imageGenerator", label: "توليد الصور",         icon: "🎨", active: true,  desc: "ينشئ صوراً عبر DALL-E 3" },
    { name: "fileWriter",     label: "كتابة الملفات",      icon: "📄", active: true,  desc: "ينشئ ويعدّل الملفات" },
    { name: "dataAnalyzer",   label: "تحليل البيانات",     icon: "📊", active: true,  desc: "يحلّل CSV وJSON والبيانات الهيكلية" },
    { name: "calculator",     label: "الحاسبة",             icon: "🔢", active: true,  desc: "عمليات رياضية وإحصاء متقدم" },
    { name: "memory",         label: "الذاكرة طويلة الأمد", icon: "🧠", active: false, desc: "يتذكر السياق عبر المحادثات" },
  ];

  const [toolStates, setToolStates] = useState<Record<string, boolean>>(
    Object.fromEntries(TOOLS_LIST.map(t => [t.name, t.active]))
  );

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Settings className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">الإعدادات</p>
          <p className="text-[10px] text-white/30">إدارة حسابك والنظام</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/6 transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <div className="w-44 shrink-0 border-l border-white/5 p-2 space-y-0.5 overflow-y-auto">
          {SETTINGS_TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-right",
                  tab === t.id
                    ? "bg-primary/12 border border-primary/20 text-primary"
                    : "text-white/35 hover:text-white/65 hover:bg-white/4"
                )}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Profile ── */}
          {tab === "profile" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">الملف الشخصي</h3>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/3 border border-white/6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {(user?.name ?? user?.email ?? "U")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.name ?? "—"}</p>
                  <p className="text-xs text-white/40 truncate">{user?.email ?? "—"}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
                    <Sparkles className="w-2.5 h-2.5" /> خطة مجانية
                  </span>
                </div>
              </div>
              {[
                { label: "الاسم الكامل",    value: user?.name  ?? "", placeholder: "أدخل اسمك" },
                { label: "البريد الإلكتروني", value: user?.email ?? "", placeholder: "email@example.com" },
              ].map((field, i) => (
                <div key={i} className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{field.label}</label>
                  <input defaultValue={field.value} placeholder={field.placeholder}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all" />
                </div>
              ))}
              <button onClick={handleSave}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  saved ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400" : "bg-primary/15 border border-primary/25 text-primary hover:bg-primary/22")}>
                {saved ? <><Check className="w-3.5 h-3.5" /> تم الحفظ</> : "حفظ التغييرات"}
              </button>
              <div className="pt-2 border-t border-white/6">
                <button onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/8 transition-all border border-transparent hover:border-red-500/15">
                  <LogOut className="w-3.5 h-3.5" /> تسجيل الخروج
                </button>
              </div>
            </div>
          )}

          {/* ── Models ── */}
          {tab === "models" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">نماذج الذكاء الاصطناعي</h3>
              <p className="text-xs text-white/35 leading-relaxed">اختر النموذج المناسب لمهامك. كل نموذج له مزايا مختلفة.</p>
              {MODELS.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/6 hover:border-white/10 transition-all">
                  <span className={cn("w-3 h-3 rounded-full shrink-0", m.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-white">{m.label}</p>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/6 border border-white/8", m.color)}>{m.badge}</span>
                    </div>
                    <p className="text-[10px] text-white/35 font-mono">{m.id}</p>
                  </div>
                  <div className="text-[10px] text-white/25 font-medium">
                    {m.id === "gpt-5.2" ? "128K توكن" : m.id === "gpt-5-nano" ? "32K توكن" : "64K توكن"}
                  </div>
                </div>
              ))}
              <div className="p-4 rounded-2xl bg-emerald-500/6 border border-emerald-500/15">
                <p className="text-xs font-semibold text-emerald-400/80 mb-1">الحالة</p>
                <p className="text-[11px] text-white/40 leading-relaxed">جميع النماذج تعمل بشكل كامل عبر Zanix AI. يمكنك الاختيار بينها من شريط الأدوات في المحادثة.</p>
              </div>
            </div>
          )}

          {/* ── Integrations ── */}
          {tab === "integrations" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">التكاملات</h3>
              <p className="text-xs text-white/35 leading-relaxed">وصّل Zanix مع خدماتك المفضلة لتوسيع قدراته.</p>
              <div className="space-y-2">
                {INTEGRATIONS_LIST.map((intg, i) => (
                  <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/3 border border-white/6 hover:border-white/10 transition-all group">
                    <span className="text-xl shrink-0">{intg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white/80">{intg.name}</p>
                      <p className="text-[10px] text-white/30">{intg.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", intg.color)}>
                        {intg.status}
                      </span>
                      {intg.status === "غير متصل" && (
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary px-2 py-1 rounded-lg bg-primary/8 border border-primary/15">
                          <ExternalLink className="w-3 h-3" /> ربط
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tools ── */}
          {tab === "tools" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">إدارة الأدوات</h3>
              <p className="text-xs text-white/35 leading-relaxed">فعّل أو عطّل الأدوات التي يستخدمها الوكيل أثناء تنفيذ المهام.</p>
              <div className="space-y-2">
                {TOOLS_LIST.map((tool) => (
                  <div key={tool.name} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/3 border border-white/6 hover:border-white/10 transition-all">
                    <span className="text-lg shrink-0">{tool.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white/75">{tool.label}</p>
                      <p className="text-[10px] text-white/30">{tool.desc}</p>
                    </div>
                    <button
                      onClick={() => setToolStates(p => ({ ...p, [tool.name]: !p[tool.name] }))}
                      className={cn(
                        "w-10 h-5.5 rounded-full border transition-all relative shrink-0",
                        toolStates[tool.name]
                          ? "bg-primary/30 border-primary/40"
                          : "bg-white/6 border-white/10"
                      )}>
                      <motion.div
                        animate={{ x: toolStates[tool.name] ? 18 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full",
                          toolStates[tool.name] ? "bg-primary" : "bg-white/25"
                        )} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Appearance ── */}
          {tab === "appearance" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">المظهر</h3>
              {[
                { label: "نظام الألوان", options: ["داكن (افتراضي)", "فاتح", "تلقائي"] },
                { label: "حجم الخط",    options: ["صغير", "متوسط (افتراضي)", "كبير"] },
                { label: "كثافة الخلفية 3D", options: ["منخفضة", "متوسطة (افتراضي)", "عالية"] },
              ].map((pref, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{pref.label}</label>
                  <div className="flex gap-2 flex-wrap">
                    {pref.options.map((opt, j) => (
                      <button key={j}
                        className={cn("px-3 py-1.5 rounded-xl text-xs border transition-all",
                          j === 1 ? "bg-primary/12 border-primary/25 text-primary" : "bg-white/4 border-white/8 text-white/40 hover:border-white/16 hover:text-white/60")}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === "notifications" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">الإشعارات</h3>
              {[
                { label: "إشعار عند اكتمال المهمة",    active: true },
                { label: "إشعارات الأخطاء والتنبيهات", active: true },
                { label: "نصائح وتحديثات المنتج",      active: false },
                { label: "إشعارات البريد الإلكتروني",  active: false },
              ].map((notif, i) => {
                const [on, setOn] = useState(notif.active);
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/5">
                    <p className="text-xs text-white/60">{notif.label}</p>
                    <button onClick={() => setOn(p => !p)}
                      className={cn("w-10 h-5.5 rounded-full border transition-all relative",
                        on ? "bg-primary/30 border-primary/40" : "bg-white/6 border-white/10")}>
                      <motion.div animate={{ x: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full", on ? "bg-primary" : "bg-white/25")} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Security ── */}
          {tab === "security" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">الأمان</h3>
              <div className="p-4 rounded-2xl bg-emerald-500/6 border border-emerald-500/15 flex items-start gap-3">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-emerald-400/90 mb-1">الحساب محمي</p>
                  <p className="text-[11px] text-white/40 leading-relaxed">جلسة نشطة واحدة · آخر دخول: الآن</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "تغيير كلمة المرور",     icon: Key,      desc: "ننصح بتغييرها كل 90 يوماً" },
                  { label: "سجل النشاط",             icon: Activity, desc: "آخر 30 يوم من نشاط الحساب" },
                  { label: "حذف جميع المحادثات",    icon: Database, desc: "لا يمكن التراجع عن هذا الإجراء" },
                ].map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <button key={i} className={cn(
                      "w-full flex items-center gap-3 p-3.5 rounded-2xl border text-right transition-all",
                      i === 2
                        ? "bg-red-500/5 border-red-500/12 hover:bg-red-500/10 hover:border-red-500/20"
                        : "bg-white/3 border-white/6 hover:border-white/12"
                    )}>
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center",
                        i === 2 ? "bg-red-500/10" : "bg-white/5")}>
                        <Icon className={cn("w-4 h-4", i === 2 ? "text-red-400" : "text-white/40")} />
                      </div>
                      <div className="flex-1 text-right">
                        <p className={cn("text-xs font-semibold", i === 2 ? "text-red-400/80" : "text-white/65")}>{action.label}</p>
                        <p className="text-[10px] text-white/30">{action.desc}</p>
                      </div>
                      <ChevronLeft className="w-3.5 h-3.5 text-white/20" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function SidebarContent({ user, sessions, currentSessionId, onNewChat, onSelectSession, onLogout, onIntegrations, onSettings, onAdmin }: {
  user: any; sessions: any[]; currentSessionId: string | null;
  onNewChat: () => void; onSelectSession: (id: string) => void;
  onLogout: () => void; onIntegrations: () => void; onSettings: () => void; onAdmin: () => void;
}) {
  return (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/6 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/10 border border-primary/22 flex items-center justify-center shadow-[0_0_20px_hsl(260_84%_63%/0.15)]">
          <ZanixLogo size={20} />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-tight">Zanix AI</p>
          <p className="text-[10px] text-white/30">الوكيل الذكي المتكامل</p>
        </div>
        <div className="mr-auto flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400/70 font-semibold">مباشر</span>
        </div>
      </div>

      {/* New chat */}
      <div className="p-3 shrink-0">
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary/15 to-violet-600/8 border border-primary/22 text-primary text-xs font-bold hover:from-primary/22 hover:to-violet-600/14 transition-all shadow-[0_0_16px_hsl(260_84%_63%/0.1)]">
          <Plus className="w-4 h-4" />
          محادثة جديدة
        </motion.button>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {sessions.length > 0 && (
          <p className="text-[9px] font-bold text-white/18 uppercase tracking-[0.15em] px-3 pt-1.5 pb-2">المحادثات الأخيرة</p>
        )}
        {sessions.map((s: any) => (
          <SessionItem key={s.sessionId} session={s} isActive={s.sessionId === currentSessionId} onClick={() => onSelectSession(s.sessionId)} />
        ))}
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
            <div className="w-10 h-10 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white/15" />
            </div>
            <p className="text-xs text-white/22">لا توجد محادثات بعد</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/6 space-y-1 shrink-0">
        <button onClick={onSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/4 transition-all text-xs">
          <Settings className="w-3.5 h-3.5" />
          <span>الإعدادات</span>
        </button>
        <button onClick={onIntegrations}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/4 transition-all text-xs">
          <Layers className="w-3.5 h-3.5" />
          <span>التكاملات</span>
        </button>
        {user?.role === "admin" && (
          <button onClick={onAdmin}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/8 transition-all text-xs border border-transparent hover:border-amber-500/15">
            <Shield className="w-3.5 h-3.5" />
            <span>لوحة الإدارة</span>
          </button>
        )}
        {user && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/3 border border-white/6 mt-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {(user.name ?? user.email ?? "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/70 truncate">{user.name ?? user.email}</p>
              <p className="text-[10px] text-white/25 truncate">{user.email}</p>
            </div>
            <button onClick={onLogout} className="text-white/20 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/8 shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Model Selector ───────────────────────────────────────────────
function ModelSelector({ model, setModel }: { model: string; setModel: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODELS.find(m => m.id === model) ?? MODELS[0];

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/7 hover:border-white/14 transition-all text-[11px] font-semibold text-white/50 hover:text-white/75">
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", current.dot)} />
        <span className="hidden sm:block max-w-[70px] truncate">{current.label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }} transition={{ duration: 0.14 }}
            className="absolute bottom-full mb-2 right-0 w-44 bg-[hsl(228_25%_7%)] border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-50"
          >
            <div className="p-1.5 space-y-0.5">
              {MODELS.map(m => (
                <button key={m.id} onClick={() => { setModel(m.id); setOpen(false); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-right",
                    model === m.id ? "bg-white/8 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/4")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", m.dot)} />
                  <span className="flex-1">{m.label}</span>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/6", m.color)}>{m.badge}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Suggestions (4 only, 2×2) ───────────────────────────────────
const SUGGESTIONS = [
  {
    icon: <Search  className="w-4 h-4" />,
    title: "ابحث في الويب",
    sub:   "أحدث أخبار الذكاء الاصطناعي",
    color: "from-blue-500/12 to-cyan-500/6",
    border: "border-blue-500/18",
    iconBg: "bg-blue-500/12 text-blue-400",
  },
  {
    icon: <Code2   className="w-4 h-4" />,
    title: "اكتب كوداً",
    sub:   "Python، JS، أي لغة تريدها",
    color: "from-violet-500/12 to-purple-500/6",
    border: "border-violet-500/18",
    iconBg: "bg-violet-500/12 text-violet-400",
  },
  {
    icon: <FileText className="w-4 h-4" />,
    title: "حرّر محتوى",
    sub:   "تقارير، مقالات، نصوص احترافية",
    color: "from-emerald-500/12 to-teal-500/6",
    border: "border-emerald-500/18",
    iconBg: "bg-emerald-500/12 text-emerald-400",
  },
  {
    icon: <Brain   className="w-4 h-4" />,
    title: "فسّر مفهوماً",
    sub:   "الشبكات العصبية، الـ LLMs…",
    color: "from-amber-500/12 to-orange-500/6",
    border: "border-amber-500/18",
    iconBg: "bg-amber-500/12 text-amber-400",
  },
];

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ onSelectSuggestion }: { onSelectSuggestion: (text: string) => void }) {
  const PROMPTS = [
    "ابحث عن آخر أخبار الذكاء الاصطناعي وأعطني ملخصاً",
    "اكتب كود Python لتحليل ملف CSV وإنشاء مخططات بيانية",
    "اكتب لي تقريراً احترافياً عن الذكاء الاصطناعي في الأعمال",
    "فسّر لي كيف تعمل الشبكات العصبية العميقة",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pt-6 pb-4 sm:py-8 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative text-center w-full max-w-lg">

        {/* Logo */}
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, delay: 0.05 }}
          className="relative inline-flex mb-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/20 to-violet-600/10 border border-primary/25 flex items-center justify-center shadow-[0_0_50px_hsl(260_84%_63%/0.15),0_0_0_1px_hsl(260_84%_63%/0.08)]">
            <ZanixLogo size={36} />
          </div>
          <motion.div animate={{ scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.2, repeat: 9999 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[hsl(228_22%_4%)] shadow-[0_0_8px_hsl(160_84%_39%/0.7)]">
            <div className="w-full h-full rounded-full bg-emerald-400" />
          </motion.div>
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1.5">
          كيف يمكنني مساعدتك؟
        </motion.h2>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
          className="text-white/35 text-xs sm:text-sm mb-6 sm:mb-7 leading-relaxed max-w-sm mx-auto">
          ابحث في الويب، اكتب الكود، حلّل البيانات، وأنجز مهامك المعقدة
        </motion.p>

        {/* Scrollable suggestion cards */}
        <div className="relative w-full max-w-lg mx-auto">
          <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar px-1">
            {SUGGESTIONS.map((s, i) => (
              <motion.button key={i}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i + 0.28 }}
                whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                onClick={() => onSelectSuggestion(PROMPTS[i])}
                className={cn(
                  "flex-shrink-0 w-40 sm:w-44 flex flex-col items-start gap-2.5 px-3.5 py-3.5 rounded-2xl bg-gradient-to-br border text-right transition-all group snap-start",
                  s.color, s.border,
                  "hover:shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                )}>
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", s.iconBg)}>
                  {s.icon}
                </div>
                <div className="text-right w-full">
                  <p className="text-xs font-bold text-white/80 leading-tight mb-0.5">{s.title}</p>
                  <p className="text-[11px] text-white/40 leading-snug">{s.sub}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Capabilities pills */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="flex flex-wrap items-center justify-center gap-2 mt-6">
          {[
            { icon: <Globe className="w-3 h-3" />, label: "بحث ويب" },
            { icon: <Code2 className="w-3 h-3" />, label: "كتابة كود" },
            { icon: <Zap   className="w-3 h-3" />, label: "٢١ أداة" },
            { icon: <Workflow className="w-3 h-3" />, label: "وكلاء متعددون" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/4 border border-white/6 text-[10px] text-white/30 font-medium">
              <span className="text-white/25">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────
export default function ChatPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const sessionId = (params as any)?.sessionId as string | undefined;

  const { data: meData }       = useGetMe();
  const logoutMutation         = useLogout();
  const createSessionMutation  = useCreateSession();
  const { data: sessionsData } = useListSessions();
  const orchestrateMutation    = useOrchestrateSync();

  const [messages, setMessages]                   = useState<Message[]>([]);
  const [input, setInput]                         = useState("");
  const [currentSessionId, setCurrentSessionId]   = useState<string | null>(sessionId ?? null);
  const [isRunning, setIsRunning]                 = useState(false);
  const [sidebarOpen, setSidebarOpen]             = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen]           = useState(false);
  const [liveSteps, setLiveSteps]                 = useState<TraceStep[]>([]);
  const [activeSseTaskId, setActiveSseTaskId]     = useState<string | null>(null);
  const [useOrchestrate, setUseOrchestrate]       = useState(false);
  const [selectedModel, setSelectedModel]         = useState("gpt-5.2");
  const [showScrollBtn, setShowScrollBtn]         = useState(false);
  const [attachedFiles, setAttachedFiles]         = useState<Attachment[]>([]);
  const [isListening, setIsListening]             = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const messagesRef    = useRef<HTMLDivElement>(null);
  const sseRef         = useRef<EventSource | null>(null);
  const liveStepsRef   = useRef<TraceStep[]>([]);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const user     = (meData as any)?.user;
  const sessions = (sessionsData as any)?.sessions ?? [];

  // Scroll detection
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const handler = () => { setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120); };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { if (!showScrollBtn) scrollToBottom(); }, [messages.length, showScrollBtn]);
  useEffect(() => { if (meData && !user) setLocation("/auth"); }, [meData]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  const connectSSE = useCallback((taskId: string, assistantMsgId: string) => {
    sseRef.current?.close();
    setActiveSseTaskId(taskId);
    setLiveSteps([]);
    liveStepsRef.current = [];

    const sse = new EventSource(`/api/agent/tasks/${taskId}/stream`);
    sseRef.current = sse;

    sse.addEventListener("step", (e) => {
      const step = JSON.parse(e.data) as TraceStep;
      liveStepsRef.current = [...liveStepsRef.current.filter(s => s.stepIndex !== step.stepIndex), step]
        .sort((a, b) => a.stepIndex - b.stepIndex);
      setLiveSteps([...liveStepsRef.current]);
    });

    sse.addEventListener("done", (e) => {
      const data = JSON.parse(e.data);
      setIsRunning(false);
      setActiveSseTaskId(null);
      sse.close();
      const finalSteps = [...liveStepsRef.current];
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: data.result ?? m.content, isStreaming: false, steps: finalSteps, tokensUsed: data.tokensUsed }
          : m
      ));
    });

    sse.onerror = () => { setIsRunning(false); setActiveSseTaskId(null); sse.close(); };
  }, []);

  const ensureSession = async () => {
    if (currentSessionId) return currentSessionId;
    const res = await createSessionMutation.mutateAsync({ data: {} });
    const sid = (res as any).session?.sessionId;
    if (sid) { setCurrentSessionId(sid); setLocation(`/chat/${sid}`); }
    return sid;
  };

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognitionCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor() as any;
    rec.lang              = "ar-SA";
    rec.interimResults    = true;
    rec.maxAlternatives   = 1;
    rec.continuous        = false;
    rec.onresult = (event: any) => {
      const transcript = Array.from(event.results as any[])
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
    };
    rec.onend  = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    files.forEach(file => {
      if (file.size > 15 * 1024 * 1024) return; // 15MB limit
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const isImage = file.type.startsWith("image/");
        setAttachedFiles(prev => [...prev, {
          id: crypto.randomUUID(),
          name: file.name,
          type: isImage ? "image" : "file",
          dataUrl,
          mimeType: file.type,
          size: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || isRunning) return;
    const currentAttachments = [...attachedFiles];
    setInput("");
    setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message      = { id: crypto.randomUUID(), role: "user", content: text, attachments: currentAttachments, createdAt: new Date() };
    const assistantId           = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", isStreaming: true, createdAt: new Date() };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsRunning(true);
    setLiveSteps([]);

    try {
      const sid = await ensureSession();
      const imageDataUrls = currentAttachments.filter(a => a.type === "image").map(a => a.dataUrl);
      const fileContextParts = currentAttachments.filter(a => a.type === "file").map(a => `[ملف مرفق: ${a.name}]`);
      const fullGoal = [text, ...fileContextParts].filter(Boolean).join("\n");

      if (useOrchestrate) {
        const res = await orchestrateMutation.mutateAsync({ data: { sessionId: sid, goal: fullGoal, maxAgents: 4 } }) as any;
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: res.finalAnswer ?? "اكتمل التنسيق.", isStreaming: false, subResults: res.subResults, tokensUsed: res.totalTokensUsed }
            : m
        ));
        setIsRunning(false);
      } else {
        const startRes = await fetch("/api/agent/run/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, goal: fullGoal, model: selectedModel, images: imageDataUrls.length > 0 ? imageDataUrls : undefined }),
          credentials: "include",
          cache: "no-store",
        });
        if (!startRes.ok) throw new Error(`فشل الاتصال بالخادم (${startRes.status})`);
        const { taskId } = await startRes.json();
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, taskId } : m));
        connectSSE(taskId, assistantId);
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: "", isStreaming: false, error: err?.message ?? "حدث خطأ غير متوقع." } : m
      ));
      setIsRunning(false);
    }
  };

  const stopAgent = () => {
    sseRef.current?.close();
    setIsRunning(false);
    setActiveSseTaskId(null);
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false, content: m.content || "تم إيقاف الوكيل." } : m));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const newChat = () => {
    setMessages([]); setCurrentSessionId(null);
    setLiveSteps([]); setActiveSseTaskId(null); setMobileSidebarOpen(false);
    setLocation("/chat");
  };

  const chatTitle = messages.length > 0
    ? messages[0].content.slice(0, 50) + (messages[0].content.length > 50 ? "…" : "")
    : "محادثة جديدة";

  return (
    <div className="flex h-dvh bg-[hsl(228_22%_4%)] text-white overflow-hidden" dir="rtl">

      {/* ── Settings Modal (full-screen overlay) ──────────────── */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div key="settings-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]" />
            <motion.div key="settings-panel"
              initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-4 sm:inset-8 md:inset-12 lg:inset-16 xl:inset-24 bg-[hsl(228_22%_5%)] border border-white/8 rounded-3xl z-[70] flex flex-col overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
              onClick={e => e.stopPropagation()}
            >
              <SettingsPanel
                user={user}
                onClose={() => setSettingsOpen(false)}
                onLogout={() => { logoutMutation.mutateAsync().then(() => setLocation("/")); setSettingsOpen(false); }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile Sidebar Overlay (slides from right for RTL) ─── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/65 backdrop-blur-sm z-40 md:hidden" />
            <motion.aside key="mobile-sidebar"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed right-0 top-0 bottom-0 w-[280px] flex flex-col bg-[hsl(228_22%_5%)] border-l border-white/8 z-50 md:hidden"
            >
              <SidebarContent
                user={user} sessions={sessions} currentSessionId={currentSessionId}
                onNewChat={newChat}
                onSelectSession={(sid) => { setCurrentSessionId(sid); setLocation(`/chat/${sid}`); setMobileSidebarOpen(false); }}
                onLogout={() => logoutMutation.mutateAsync().then(() => setLocation("/"))}
                onIntegrations={() => { setLocation("/integrations"); setMobileSidebarOpen(false); }}
                onSettings={() => { setSettingsOpen(true); setMobileSidebarOpen(false); }}
                onAdmin={() => { setLocation("/admin"); setMobileSidebarOpen(false); }}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>


      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside key="sidebar"
            initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="hidden md:flex flex-col border-l border-white/6 bg-white/[0.015] overflow-hidden shrink-0"
          >
            <SidebarContent user={user} sessions={sessions} currentSessionId={currentSessionId}
              onNewChat={newChat}
              onSelectSession={(sid) => { setCurrentSessionId(sid); setLocation(`/chat/${sid}`); }}
              onLogout={() => logoutMutation.mutateAsync().then(() => setLocation("/"))}
              onIntegrations={() => setLocation("/integrations")}
              onSettings={() => setSettingsOpen(true)}
              onAdmin={() => setLocation("/admin")}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main area ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Topbar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/6 bg-[hsl(228_22%_5%)]/80 backdrop-blur-xl shrink-0 z-10">
          {/* Mobile menu */}
          <button onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white/75 hover:bg-white/6 transition-all shrink-0">
            <Menu className="w-4 h-4" />
          </button>

          {/* Desktop sidebar toggle */}
          <button onClick={() => setSidebarOpen(p => !p)}
            className="hidden md:flex w-8 h-8 rounded-xl items-center justify-center text-white/35 hover:text-white/75 hover:bg-white/6 transition-all shrink-0">
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/55 truncate">{chatTitle}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Multi-agent toggle — hidden on mobile */}
            <button onClick={() => setUseOrchestrate(p => !p)}
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all",
                useOrchestrate ? "bg-violet-500/12 border-violet-500/25 text-violet-300" : "bg-white/4 border-white/8 text-white/35 hover:text-white/65"
              )}>
              <Workflow className="w-3.5 h-3.5" />
              <span className="hidden lg:block">{useOrchestrate ? "تعدد وكلاء" : "وكيل واحد"}</span>
            </button>
          </div>
        </div>

        {/* ── Messages ──────────────────────────────────────────── */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            <EmptyState onSelectSuggestion={(text) => { setInput(text); setTimeout(() => textareaRef.current?.focus(), 50); }} />
          ) : (
            <div className="max-w-3xl mx-auto w-full py-4 sm:py-6 pb-2 space-y-0">
              {messages.map(msg => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  liveSteps={liveSteps}
                  activeSseTaskId={activeSseTaskId}
                />
              ))}
              <div ref={bottomRef} className="h-6" />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 8 }}
              onClick={scrollToBottom}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[hsl(228_22%_9%)] border border-white/14 flex items-center justify-center text-white/50 hover:text-white hover:bg-[hsl(228_22%_12%)] transition-all shadow-lg z-20">
              <ChevronUp className="w-4 h-4 rotate-180" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Input area ──────────────────────────────────────── */}
        <div className="shrink-0 px-3 sm:px-4 py-2.5 sm:py-3.5 border-t border-white/6 bg-[hsl(228_22%_5%)]/80 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto">
            <div className={cn(
              "relative flex flex-col rounded-2xl border transition-all duration-200",
              isRunning
                ? "border-primary/20 bg-primary/3 shadow-[0_0_0_3px_hsl(260_84%_63%/0.06)]"
                : "border-white/8 bg-white/[0.04] focus-within:border-primary/30 focus-within:bg-white/[0.055] focus-within:shadow-[0_0_0_3px_hsl(260_84%_63%/0.05)]"
            )}>
              {/* Attachment previews */}
              <AnimatePresence>
                {attachedFiles.length > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="flex flex-wrap gap-2 px-4 pt-3 pb-0 overflow-hidden">
                    {attachedFiles.map(att => (
                      <AttachChip key={att.id} att={att} onRemove={() => setAttachedFiles(p => p.filter(a => a.id !== att.id))} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRunning ? "الوكيل يعمل…" : "اكتب رسالتك… (أو أرسل صورة 🖼️)"}
                disabled={isRunning}
                rows={1}
                dir="auto"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/22 resize-none focus:outline-none leading-relaxed px-4 pt-3.5 pb-2 min-h-[50px] max-h-[140px] disabled:opacity-40"
              />

              {/* Toolbar */}
              <div className="flex items-center justify-between px-2.5 sm:px-3 pb-2.5 gap-2">
                {/* Left tools */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.md,.csv,.js,.ts,.py,.json,.html,.css"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRunning}
                    title="إرفاق صورة أو ملف"
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-0",
                      attachedFiles.length > 0
                        ? "text-primary bg-primary/10 border border-primary/20"
                        : "text-white/30 hover:text-white/65 hover:bg-white/6"
                    )}>
                    <Paperclip className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
                    onClick={toggleListening}
                    disabled={isRunning}
                    title={isListening ? "إيقاف الاستماع" : "إدخال صوتي"}
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-0",
                      isListening
                        ? "text-red-400 bg-red-500/12 border border-red-500/25 animate-pulse"
                        : "text-white/25 hover:text-white/55 hover:bg-white/6"
                    )}>
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </motion.button>
                  <ModelSelector model={selectedModel} setModel={setSelectedModel} />
                </div>

                {/* Right: char count + send / stop */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {input.length > 80 && !isRunning && (
                    <span className={cn("text-[10px] tabular-nums hidden sm:block", input.length > 2000 ? "text-red-400" : "text-white/20")}>
                      {input.length}
                    </span>
                  )}
                  {isRunning ? (
                    <motion.button initial={{ scale: 0.85 }} animate={{ scale: 1 }} onClick={stopAgent}
                      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-all text-[11px] font-bold whitespace-nowrap">
                      <Square className="w-3 h-3 fill-current" />
                      <span className="hidden sm:block">إيقاف</span>
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
                      onClick={sendMessage}
                      disabled={!input.trim() && attachedFiles.length === 0}
                      className={cn(
                        "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all",
                        (input.trim() || attachedFiles.length > 0)
                          ? "bg-gradient-to-br from-primary to-violet-600 text-white shadow-[0_2px_18px_hsl(260_84%_63%/0.45)]"
                          : "bg-white/5 text-white/15 cursor-not-allowed"
                      )}>
                      <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer hint — desktop only */}
            <p className="hidden sm:block text-center text-[10px] text-white/12 mt-1.5 select-none">
              {useOrchestrate
                ? <span className="flex items-center justify-center gap-1"><Sparkles className="w-3 h-3 text-violet-400/60" /> وضع تعدد الوكلاء — حتى ٦ وكلاء متوازية</span>
                : <span>Enter للإرسال · Shift+Enter لسطر جديد · {MODELS.find(m => m.id === selectedModel)?.label}</span>
              }
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
