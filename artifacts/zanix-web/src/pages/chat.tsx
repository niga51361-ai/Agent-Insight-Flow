import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Plus, MessageSquare, LogOut, Loader2, Menu, X, Sparkles,
  Zap, Terminal, Search, BarChart3, Hammer, FileText, Database, Brain,
  ChevronRight, ChevronDown, Copy, Check, Clock, Cpu, Activity,
  Globe, Code2, Image, ArrowUpRight, AlertCircle, Settings,
  Layers, ArrowLeft, Bot, PanelRight, PanelRightClose, RefreshCw,
  ListChecks, CirclePlay, CheckCircle2, XCircle, Hourglass
} from "lucide-react";
import {
  useGetMe, useLogout, useCreateSession, useListSessions,
  useGetSession, useRunAgent, useOrchestrateSync, useListOrchestrations
} from "@workspace/api-client-react";
import { cn, formatDate } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

import FeatherLogo from "@/components/feather-logo";

// ─── Agent config ─────────────────────────────────────────────────
const AGENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string }> = {
  researcher: { icon: <Search className="w-3 h-3" />, color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/15", label: "Researcher" },
  coder:      { icon: <Terminal className="w-3 h-3" />, color: "text-violet-400", bg: "bg-violet-500/8", border: "border-violet-500/15", label: "Coder" },
  builder:    { icon: <Hammer className="w-3 h-3" />, color: "text-pink-400", bg: "bg-pink-500/8", border: "border-pink-500/15", label: "Builder" },
  analyst:    { icon: <BarChart3 className="w-3 h-3" />, color: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/15", label: "Analyst" },
  fetcher:    { icon: <Database className="w-3 h-3" />, color: "text-amber-400", bg: "bg-amber-500/8", border: "border-amber-500/15", label: "Fetcher" },
  writer:     { icon: <FileText className="w-3 h-3" />, color: "text-cyan-400", bg: "bg-cyan-500/8", border: "border-cyan-500/15", label: "Writer" },
  generalist: { icon: <Brain className="w-3 h-3" />, color: "text-violet-400", bg: "bg-violet-500/8", border: "border-violet-500/15", label: "Generalist" },
};

// ─── Tool icon ────────────────────────────────────────────────────
function ToolIcon({ name }: { name: string }) {
  if (!name) return <Zap className="w-3 h-3" />;
  if (name.includes("search") || name.includes("browse")) return <Globe className="w-3 h-3" />;
  if (name.includes("code") || name.includes("exec") || name.includes("debug")) return <Code2 className="w-3 h-3" />;
  if (name.includes("data") || name.includes("calc")) return <BarChart3 className="w-3 h-3" />;
  if (name.includes("image") || name.includes("vision")) return <Image className="w-3 h-3" />;
  if (name.includes("memory")) return <Brain className="w-3 h-3" />;
  if (name.includes("web") || name.includes("http")) return <Globe className="w-3 h-3" />;
  return <Zap className="w-3 h-3" />;
}

// ─── Copy button ──────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.button
      whileHover={{ scale: 1.15, rotate: 2 }} 
      whileTap={{ scale: 0.85 }}
      onClick={copy}
      title="Copy to clipboard"
      className={cn(
        "p-1.5 rounded-lg transition-all",
        copied 
          ? "bg-emerald-500/15 text-emerald-400" 
          : "glass-light text-white/35 hover:text-white/70 hover:bg-white/10"
      )}
    >
      <AnimatePresence mode="wait">
        {copied
          ? <motion.div key="check" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 180 }} transition={{ duration: 0.3 }}><Check className="w-3.5 h-3.5 text-emerald-400" /></motion.div>
          : <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.3 }}><Copy className="w-3.5 h-3.5" /></motion.div>
        }
      </AnimatePresence>
    </motion.button>
  );
}

// ─── Step timeline ────────────────────────────────────────────────
function StepTimeline({ steps }: { steps: any[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white/55 transition-colors mb-2 group"
      >
        <Activity className="w-3.5 h-3.5 group-hover:text-primary/60 transition-colors" />
        <span>{steps.length} reasoning step{steps.length !== 1 ? "s" : ""}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", expanded && "rotate-180")} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pb-1">
              {steps.map((step: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn("relative pl-7", i < steps.length - 1 && "step-connector")}
                >
                  <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-white/4 border border-white/8 flex items-center justify-center text-white/35">
                    <ToolIcon name={step.toolName} />
                  </div>
                    <motion.div 
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="glass-elevated rounded-xl p-3 text-xs border border-white/6 shadow-[0_2px_8px_hsl(260_84%_63%/0.05)]"
                    >
                    {step.thought && (
                      <p className="text-white/40 italic mb-2 leading-relaxed line-clamp-2">{step.thought}</p>
                    )}
                    {step.toolName && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="font-mono text-violet-300/90 bg-violet-500/12 px-2 py-0.5 rounded-md text-[10px] border border-violet-500/18">
                          {step.toolName}
                        </span>
                      </div>
                    )}
                    {step.observation && (
                      <p className="text-white/35 line-clamp-2 text-[11px] leading-relaxed">{step.observation}</p>
                    )}
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-agent swarm cards ────────────────────────────────────────
function SubAgentCards({ subResults }: { subResults: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const success = subResults.filter(s => s.success).length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 glass-elevated rounded-2xl border border-primary/15 overflow-hidden shadow-[0_4px_16px_hsl(260_84%_63%/0.08)]"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/4 transition-colors duration-200"
      >
        <div className="flex items-center gap-2.5">
          <motion.div 
            animate={{ boxShadow: ["0_0_0_hsl(260_84%_63%/0)", "0_0_12px_hsl(260_84%_63%/0.3)", "0_0_0_hsl(260_84%_63%/0)"] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-6 rounded-lg bg-primary/18 border border-primary/25 flex items-center justify-center"
          >
            <Cpu className="w-3 h-3 text-primary/90" />
          </motion.div>
          <span className="text-xs font-bold text-primary/85">Multi-Agent Swarm</span>
          <span className="text-[11px] text-white/40">— {subResults.length} parallel tasks</span>
        </div>
        <div className="flex items-center gap-3">
          <motion.span 
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-[11px] font-semibold text-emerald-400"
          >
            {success}/{subResults.length} done
          </motion.span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-white/40 transition-transform duration-200", expanded && "rotate-180")} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-white/5 pt-3">
              {subResults.map((sub: any, idx: number) => {
                const cfg = AGENT_CONFIG[sub.specialization] ?? AGENT_CONFIG.generalist;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={cn("rounded-xl p-3.5 border text-xs", cfg.bg, cfg.border)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn("flex items-center gap-1.5 font-bold", cfg.color)}>
                        {cfg.icon}
                        {cfg.label}
                      </div>
                      <span className={cn(
                        "flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        sub.success
                          ? "bg-emerald-500/12 text-emerald-400 border border-emerald-500/15"
                          : "bg-red-500/12 text-red-400 border border-red-500/15"
                      )}>
                        {sub.success ? <Check className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                        {sub.success ? "Done" : "Failed"}
                      </span>
                    </div>
                    <p className="text-white/45 leading-relaxed mb-2 text-[11px]">{sub.subGoal}</p>
                    <div className="flex items-center gap-3 text-white/20 text-[10px]">
                      <span className="font-mono">{sub.stepsCount ?? 0} steps</span>
                      {sub.artifactsCount > 0 && <span>{sub.artifactsCount} artifacts</span>}
                    </div>
                    {sub.resultPreview && (
                      <p className="mt-2 pt-2 text-white/30 line-clamp-2 text-[11px] border-t border-white/5">
                        {sub.resultPreview}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Streaming Text ───────────────────────────────────────────────
function StreamingText({ text, onDone }: { text: string; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");
    setDone(false);
    const interval = setInterval(() => {
      indexRef.current += Math.floor(Math.random() * 4) + 2;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
        onDone?.();
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, 12);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="inline-block w-0.5 h-3.5 bg-primary/70 ml-0.5 align-middle rounded-full"
        />
      )}
    </span>
  );
}

// ─── Action Confirmation Dialog ───────────────────────────────────
export interface ActionConfirmProps {
  action: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  onConfirm: () => void;
  onCancel: () => void;
}

function ActionConfirmDialog({ action, description, riskLevel, onConfirm, onCancel }: ActionConfirmProps) {
  const riskConfig = {
    low:    { color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/8",  icon: "✓", label: "Low Risk" },
    medium: { color: "text-amber-400",   border: "border-amber-500/20",   bg: "bg-amber-500/8",    icon: "⚠", label: "Medium Risk" },
    high:   { color: "text-red-400",     border: "border-red-500/20",     bg: "bg-red-500/8",      icon: "!", label: "High Risk" },
  };
  const cfg = riskConfig[riskLevel];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="mb-4 glass-elevated rounded-2xl border border-white/10 overflow-hidden shadow-[0_8px_32px_hsl(260_84%_63%/0.15)]"
    >
      <div className={cn("flex items-center gap-2.5 px-4 py-2.5 border-b", cfg.bg, cfg.border)}>
        <span className={cn("text-xs font-bold", cfg.color)}>{cfg.icon} {cfg.label}</span>
        <span className="text-[11px] text-white/35 ml-auto">Zanix needs your permission</span>
      </div>
      <div className="px-4 py-4">
        <p className="text-sm font-semibold text-white/85 mb-1">{action}</p>
        <p className="text-xs text-white/45 leading-relaxed mb-4">{description}</p>
        <div className="flex gap-2.5">
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/30 text-xs font-bold text-primary transition-all duration-200"
          >
            <Check className="w-3 h-3" /> Confirm
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass-light hover:bg-white/8 border border-white/10 text-xs font-semibold text-white/50 transition-all duration-200"
          >
            <X className="w-3 h-3" /> Cancel
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────
function TypingIndicator({ multiAgent }: { multiAgent: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex items-start gap-3"
    >
      <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 flex items-center justify-center shrink-0 pulse-ring shadow-[0_2px_8px_hsl(260_84%_63%/0.12)]">
        <FeatherLogo size={18} />
      </div>
      <div className="glass-elevated rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-3 border border-white/7 shadow-[0_2px_8px_hsl(260_84%_63%/0.06)]">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary/50"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
              transition={{ duration: 0.9, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
        <span className="text-xs text-white/30 font-medium">
          {multiAgent ? "Orchestrating agents..." : "Zanix is thinking..."}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Autopilot task type ──────────────────────────────────────────
type AutopilotTask = {
  taskId: string;
  goal: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  currentStep?: string;
  result?: string;
  error?: string;
  createdAt?: string;
};

// ─── Canvas Panel ─────────────────────────────────────────────────
function CanvasPanel({ tasks, onRefresh, isRefreshing, onClose }: { tasks: AutopilotTask[]; onRefresh: () => void; isRefreshing: boolean; onClose: () => void }) {
  const [selectedTask, setSelectedTask] = useState<AutopilotTask | null>(null);

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    queued:    { icon: <Hourglass className="w-3 h-3" />, color: "text-amber-400", label: "Queued" },
    running:   { icon: <CirclePlay className="w-3 h-3" />, color: "text-blue-400", label: "Running" },
    completed: { icon: <CheckCircle2 className="w-3 h-3" />, color: "text-emerald-400", label: "Done" },
    failed:    { icon: <XCircle className="w-3 h-3" />, color: "text-red-400", label: "Failed" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="w-[300px] shrink-0 flex flex-col border-l border-white/6 bg-gradient-to-b from-[hsl(228_22%_4%)] to-[hsl(228_22%_3.5%)] overflow-hidden"
    >
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
            <ListChecks className="w-3.5 h-3.5 text-primary/90" />
          </div>
          <span className="text-xs font-bold text-white/70">Autopilot Tasks</span>
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/6 transition-all"
            title="Refresh tasks"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/25 hover:text-red-400/70 hover:bg-red-500/8 transition-all"
            title="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Bot className="w-8 h-8 text-white/12 mb-3" />
            <p className="text-xs text-white/20">No autonomous tasks yet</p>
            <p className="text-[10px] text-white/12 mt-1">Send a task with Autopilot mode on</p>
          </div>
        )}
        {tasks.map((t) => {
          const cfg = statusConfig[t.status] ?? statusConfig.queued;
          const isSelected = selectedTask?.taskId === t.taskId;
          return (
            <motion.button
              key={t.taskId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedTask(isSelected ? null : t)}
              className={cn(
                "w-full text-left rounded-xl border px-3 py-2.5 transition-all",
                isSelected
                  ? "bg-primary/10 border-primary/25 shadow-[0_0_12px_hsl(260_84%_63%/0.1)]"
                  : "border-white/6 hover:border-white/12 hover:bg-white/4"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={cn("flex items-center gap-1.5 text-[10px] font-bold", cfg.color)}>
                  {cfg.icon}
                  {cfg.label}
                </div>
                {t.status === "running" && (
                  <span className="text-[10px] text-white/30 font-mono">
                    {Math.round(t.progress)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-white/55 leading-relaxed line-clamp-2">{t.goal}</p>
              {t.status === "running" && (
                <div className="mt-2">
                  <div className="h-0.5 w-full bg-white/6 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
                      animate={{ width: `${t.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  {t.currentStep && (
                    <p className="text-[10px] text-white/25 mt-1 truncate">{t.currentStep}</p>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-white/6 overflow-hidden"
          >
            <div className="p-3 max-h-52 overflow-y-auto">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-bold">Result Preview</p>
              {selectedTask.result ? (
                <p className="text-xs text-white/55 leading-relaxed">
                  {selectedTask.result.slice(0, 600)}{selectedTask.result.length > 600 ? "..." : ""}
                </p>
              ) : selectedTask.error ? (
                <p className="text-xs text-red-400/70 leading-relaxed">{selectedTask.error}</p>
              ) : (
                <div className="flex items-center gap-2 text-white/25 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Task in progress…</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Types ────────────────────────────────────────────────────────
type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
  steps?: any[];
  subResults?: any[];
  artifacts?: any[];
};

// ─── Suggested prompts ─────────────────────�����──────────────────────
const PROMPTS = [
  { icon: Globe, color: "text-blue-400", bg: "bg-blue-500/8 border-blue-500/12", text: "Research the latest breakthroughs in AI reasoning models" },
  { icon: Terminal, color: "text-violet-400", bg: "bg-violet-500/8 border-violet-500/12", text: "Write and execute a Python script to analyze CSV data" },
  { icon: Hammer, color: "text-pink-400", bg: "bg-pink-500/8 border-pink-500/12", text: "Build a landing page for a SaaS product called Nexus" },
  { icon: BarChart3, color: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/12", text: "Fetch Bitcoin price, analyze trends, and write a full report" },
];

// ─── Main Chat ────────────────────────────────────────────────────
export default function ChatPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const sessionId = params.sessionId;

  const { data: user, isLoading: userLoading, isError: userError } = useGetMe();
  const logoutMutation = useLogout();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [multiAgentMode, setMultiAgentMode] = useState(false);
  const [autopilotMode, setAutopilotMode] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [autopilotTasks, setAutopilotTasks] = useState<AutopilotTask[]>([]);
  const [canvasRefreshing, setCanvasRefreshing] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputRows, setInputRows] = useState(1);
  const [lastStreamingId, setLastStreamingId] = useState<string | null>(null);
  const [actionConfirm, setActionConfirm] = useState<ActionConfirmProps | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: sessionsData, refetch: refetchSessions } = useListSessions();
  const createSessionMutation = useCreateSession();
  const { data: sessionData } = useGetSession(sessionId ?? "");
  const { data: orchestrationsData } = useListOrchestrations();

  // Reconstruct history
  useEffect(() => {
    if (sessionData?.tasks) {
      const history: Message[] = [];
      sessionData.tasks.forEach((t: any) => {
        history.push({ id: `u-${t.id}`, role: "user", content: t.goal, createdAt: t.createdAt });
        if (t.result) {
          history.push({ id: `a-${t.id}`, role: "agent", content: t.result, createdAt: t.completedAt || t.updatedAt });
        }
      });
      if (orchestrationsData?.orchestrations) {
        const sessionOrchs = (orchestrationsData.orchestrations as any[]).filter((o: any) => o.sessionId === sessionId);
        sessionOrchs.forEach((o: any) => {
          history.push({ id: `ou-${o.id}`, role: "user", content: o.parentGoal, createdAt: o.createdAt });
          if (o.finalResult) {
            history.push({ id: `oa-${o.id}`, role: "agent", content: o.finalResult, subResults: o.subResults, createdAt: o.completedAt || o.updatedAt });
          }
        });
      }
      history.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(history);
    } else {
      setMessages([]);
    }
  }, [sessionData, orchestrationsData, sessionId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const rows = Math.min(e.target.value.split("\n").length, 6);
    setInputRows(rows);
  };

  const runAgentMutation = useRunAgent();
  const orchestrateMutation = useOrchestrateSync();
  const isPending = runAgentMutation.isPending || orchestrateMutation.isPending;

  const fetchAutopilotTasks = useCallback(async () => {
    if (!sessionId) return;
    setCanvasRefreshing(true);
    try {
      const res = await fetch(`/api/agent/autopilot/session/${sessionId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAutopilotTasks((data.tasks ?? []).map((t: any) => ({
          taskId: t.taskId,
          goal: t.goal,
          status: t.status,
          progress: t.progress ?? 0,
          currentStep: t.currentStep,
          result: t.result,
          error: t.error,
          createdAt: t.createdAt,
        })));
      }
    } catch {
    } finally {
      setCanvasRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (canvasOpen && sessionId) fetchAutopilotTasks();
  }, [canvasOpen, sessionId]);

  useEffect(() => {
    if (!canvasOpen || !sessionId) return;
    const running = autopilotTasks.some(t => t.status === "queued" || t.status === "running");
    if (!running) return;
    const interval = setInterval(fetchAutopilotTasks, 3000);
    return () => clearInterval(interval);
  }, [canvasOpen, autopilotTasks, sessionId]);

  const handleCreateSession = async () => {
    const res = await createSessionMutation.mutateAsync({ data: { title: "New Conversation" } });
    refetchSessions();
    setLocation(`/chat/${res.session.sessionId}`);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/");
  };

  const handleSend = useCallback(async (overrideInput?: string) => {
    const msg = overrideInput ?? input;
    if (!msg.trim() || isPending) return;

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const res = await createSessionMutation.mutateAsync({ data: { title: msg.slice(0, 50) } });
      activeSessionId = res.session.sessionId;
      refetchSessions();
      setLocation(`/chat/${activeSessionId}`);
    }

    const currentInput = msg;
    setInput("");
    setInputRows(1);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: currentInput, createdAt: new Date().toISOString() }]);

    try {
      if (autopilotMode) {
        const res = await fetch("/api/agent/autopilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId: activeSessionId!, goal: currentInput, useCritic: true }),
        });
        const data = await res.json();
        const newTask: AutopilotTask = { taskId: data.taskId, goal: currentInput, status: "queued", progress: 0, currentStep: "Queued — starting soon" };
        setAutopilotTasks(prev => [newTask, ...prev]);
        setCanvasOpen(true);
        setMessages(prev => [...prev, {
          id: data.taskId || Date.now().toString(),
          role: "agent",
          content: `Autonomous task queued! Zanix will work on this in the background across up to 30 reasoning steps.\n\n**Goal:** ${currentInput.slice(0, 200)}\n\nCheck the **Autopilot Panel** on the right for live progress updates.`,
          createdAt: new Date().toISOString(),
        }]);
      } else if (multiAgentMode) {
        const res = await orchestrateMutation.mutateAsync({ data: { sessionId: activeSessionId!, goal: currentInput, maxAgents: 4 } });
        const newId = res.orchestrationId || Date.now().toString();
        setLastStreamingId(newId);
        setMessages(prev => [...prev, {
          id: newId,
          role: "agent", content: res.finalAnswer || "Orchestration completed.",
          subResults: res.subResults, createdAt: new Date().toISOString(),
        }]);
      } else {
        const res = await runAgentMutation.mutateAsync({ data: { sessionId: activeSessionId!, goal: currentInput } });
        const artifacts = (res as any).artifacts;
        const newId = res.taskId || Date.now().toString();
        setLastStreamingId(newId);
        setMessages(prev => [...prev, {
          id: newId,
          role: "agent", content: res.result, steps: res.steps,
          artifacts: Array.isArray(artifacts) ? artifacts : undefined,
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "agent",
        content: "An error occurred while processing your request. Please try again.",
        createdAt: new Date().toISOString(),
      }]);
    }
  }, [input, isPending, sessionId, multiAgentMode, autopilotMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center pulse-ring">
              <FeatherLogo size={36} />
            </div>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                transition={{ duration: 0.9, delay: i * 0.2, repeat: Infinity }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (userError || !user) {
    setLocation("/");
    return null;
  }

  const currentSession = sessionsData?.sessions?.find((s: any) => s.sessionId === sessionId);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar ─────────────────────────────────────── */}
      <motion.aside
        initial={false}
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-[260px] flex flex-col border-r border-white/6 transition-transform duration-300 ease-in-out",
          "bg-gradient-to-b from-[hsl(228_22%_4%)] via-[hsl(228_22%_3.8%)] to-[hsl(228_22%_3.5%)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo & brand */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center">
              <FeatherLogo size={18} />
            </div>
            <span className="font-display font-bold text-base tracking-tight">Zanix</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="md:hidden p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-all"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* New chat button */}
        <div className="p-3 shrink-0">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleCreateSession}
            className="w-full flex items-center gap-2.5 py-2.5 px-4 rounded-xl border border-white/7 bg-white/[0.025] hover:bg-white/[0.055] hover:border-white/12 text-sm font-medium text-white/55 hover:text-white transition-all"
          >
            <Plus className="w-4 h-4 text-primary/70" />
            New Conversation
          </motion.button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.15em] mb-2 px-3 mt-2">
            Conversations
          </p>
          <AnimatePresence>
            {sessionsData?.sessions?.map((s: any, i: number) => (
              <motion.button
                key={s.sessionId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => { setLocation(`/chat/${s.sessionId}`); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all mb-0.5 group border",
                  s.sessionId === sessionId
                    ? "bg-primary/12 border-primary/25 text-white shadow-[0_2px_8px_hsl(260_84%_63%/0.1)]"
                    : "border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80 hover:border-white/8"
                )}
              >
                <MessageSquare className={cn(
                  "w-3.5 h-3.5 shrink-0 mt-0.5 transition-colors",
                  s.sessionId === sessionId ? "text-primary/70" : "opacity-50"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{s.title || "Untitled"}</p>
                  <p className="text-[10px] text-white/20 mt-0.5">{formatDate(s.createdAt)}</p>
                </div>
                {s.sessionId === sessionId && (
                  <ChevronRight className="w-3 h-3 text-primary/40 shrink-0 self-center" />
                )}
              </motion.button>
            ))}
          </AnimatePresence>
          {(!sessionsData?.sessions || sessionsData.sessions.length === 0) && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-white/18">No conversations yet</p>
              <p className="text-[11px] text-white/12 mt-1">Start a new one above</p>
            </div>
          )}
        </div>

        {/* User profile */}
        <div className="p-3 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/6 bg-white/[0.02] group hover:bg-white/[0.04] transition-all">
            <div className="relative w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {user?.user?.name?.[0]?.toUpperCase() ?? "Z"}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[hsl(228_22%_3.5%)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/80 truncate">{user?.user?.name}</p>
              <p className="text-[10px] text-primary/55 font-semibold capitalize tracking-wide">{user?.user?.plan} Plan</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </motion.aside>

      {/* ─── Main area ───────────────────────────────────── */}
      <div className="flex-1 flex h-full overflow-hidden min-w-0">
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/6 glass-elevated z-10 shrink-0 shadow-[0_1px_3px_hsl(260_84%_63%/0.04)]">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-lg border border-white/6 text-white/35 hover:text-white hover:bg-white/5 transition-all"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </button>

            {sessionId && currentSession ? (
              <div>
                <h1 className="text-sm font-display font-bold text-white/75 hidden sm:block truncate max-w-[300px]">
                  {currentSession.title}
                </h1>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 text-white/40 text-sm">
                <FeatherLogo size={16} />
                <span className="font-medium">Chat with {user?.agentName || 'Zanix'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <motion.div 
              className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8 shadow-[0_2px_8px_hsl(260_84%_63%/0.04)]"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setMultiAgentMode(false); setAutopilotMode(false); }}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                  !multiAgentMode && !autopilotMode ? "bg-white/12 text-white shadow-[0_1px_3px_hsl(260_84%_63%/0.1)]" : "text-white/40 hover:text-white/65"
                )}
              >
                <Layers className="w-3 h-3" />
                <span className="hidden sm:block">Single</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setMultiAgentMode(true); setAutopilotMode(false); }}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                  multiAgentMode && !autopilotMode
                    ? "bg-primary/25 text-primary border border-primary/30 shadow-[0_0_16px_hsl(260_84%_63%/0.25)]"
                    : "text-white/40 hover:text-white/65"
                )}
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:block">Multi-Agent</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setAutopilotMode(true); setMultiAgentMode(false); if (!canvasOpen) setCanvasOpen(true); }}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                  autopilotMode
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_16px_hsl(180_100%_63%/0.18)]"
                    : "text-white/40 hover:text-white/65"
                )}
              >
                <Bot className="w-3 h-3" />
                <span className="hidden sm:block">Autopilot</span>
              </motion.button>
            </motion.div>

            {/* Canvas panel toggle */}
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => setCanvasOpen(!canvasOpen)}
              title={canvasOpen ? "Close canvas panel" : "Open autopilot panel"}
              className={cn(
                "p-2 rounded-xl border text-xs font-semibold transition-all",
                canvasOpen
                  ? "bg-primary/15 border-primary/30 text-primary/90"
                  : "border-white/8 text-white/35 hover:text-white/60 hover:bg-white/5"
              )}
            >
              {canvasOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            </motion.button>
          </div>
        </header>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-7">

            {/* Empty state */}
            {messages.length === 0 && !isPending && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center justify-center min-h-[56vh] text-center"
              >
                <div className="relative mb-6">
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 0 0px hsl(260 84% 63% / 0.15)",
                        "0 0 40px hsl(260 84% 63% / 0.4)",
                        "0 0 0px hsl(260 84% 63% / 0.15)"
                      ],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 flex items-center justify-center shadow-[0_4px_16px_hsl(260_84%_63%/0.12)]"
                  >
                    <FeatherLogo size={36} />
                  </motion.div>
                  {multiAgentMode && (
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg"
                    >
                      <Zap className="w-2.5 h-2.5 text-white" />
                    </motion.span>
                  )}
                </div>

                <h2 className="text-2xl font-display font-extrabold mb-2.5 text-white/85">
                  {multiAgentMode ? "Multi-Agent Swarm Ready" : "How can I help?"}
                </h2>
                <p className="text-white/30 text-sm max-w-sm mb-10 leading-relaxed">
                  {multiAgentMode
                    ? "I'll deploy specialized agents in parallel — Researcher, Coder, Analyst, Builder and more — all simultaneously."
                    : "I can browse the web, write and run code, analyze data, and build complete applications."}
                </p>

                {/* Prompt suggestions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {PROMPTS.map((p, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 12 }} 
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ scale: 1.04, y: -2, transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleSend(p.text)}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-2xl border text-left transition-all group shadow-[0_2px_8px_hsl(260_84%_63%/0.04)] hover:shadow-[0_4px_16px_hsl(260_84%_63%/0.08)]",
                        p.bg,
                        "hover:border-opacity-50"
                      )}
                    >
                      <div className={cn("w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center shrink-0 mt-0.5", p.color)}>
                        <p.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-white/45 group-hover:text-white/70 transition-colors text-xs leading-relaxed">{p.text}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 shrink-0 self-start mt-0.5 transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id + i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "user" ? (
                  /* User bubble */
                  <div className="max-w-[78%] md:max-w-[65%] group">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gradient-to-br from-primary/18 to-primary/12 border border-primary/25 text-white/90 px-5 py-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap shadow-[0_2px_12px_hsl(260_84%_63%/0.08)]"
                    >
                      {msg.content}
                    </motion.div>
                    <div className="flex items-center justify-end gap-1.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-white/20">{formatDate(msg.createdAt)}</span>
                      <CopyButton text={msg.content} />
                    </div>
                  </div>
                ) : (
                  /* Agent bubble */
                  <div className="w-full max-w-full group">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <FeatherLogo size={18} />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Sub-agent swarm */}
                        {msg.subResults && msg.subResults.length > 0 && (
                          <SubAgentCards subResults={msg.subResults} />
                        )}

                        {/* Answer content */}
                        <motion.div 
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35 }}
                          className="glass-elevated rounded-2xl rounded-tl-sm px-5 py-4 prose-zanix border border-white/6 shadow-[0_4px_20px_hsl(260_84%_63%/0.06)]"
                        >
                          {msg.id === lastStreamingId ? (
                            <StreamingText
                              text={msg.content}
                              onDone={() => setLastStreamingId(null)}
                            />
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </motion.div>

                        {/* Steps */}
                        {msg.steps && msg.steps.length > 0 && (
                          <StepTimeline steps={msg.steps} />
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Clock className="w-3 h-3 text-white/18" />
                          <span className="text-[10px] text-white/20">{formatDate(msg.createdAt)}</span>
                          <CopyButton text={msg.content} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Action Confirmation */}
            <AnimatePresence>
              {actionConfirm && (
                <ActionConfirmDialog
                  action={actionConfirm.action}
                  description={actionConfirm.description}
                  riskLevel={actionConfirm.riskLevel}
                  onConfirm={() => { actionConfirm.onConfirm(); setActionConfirm(null); }}
                  onCancel={() => { actionConfirm.onCancel(); setActionConfirm(null); }}
                />
              )}
            </AnimatePresence>

            {/* Typing */}
            <AnimatePresence>
              {isPending && <TypingIndicator multiAgent={multiAgentMode} />}
            </AnimatePresence>

            {/* Bottom spacer */}
            <div className="h-28" />
          </div>
        </div>

        {/* ─── Input ─────────────────────────────────────── */}
        <div className="relative shrink-0">
          <div className="absolute -top-16 inset-x-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <div className="bg-background border-t border-white/5 px-4 pb-4 pt-3">
            <div className="max-w-3xl mx-auto">
              <AnimatePresence>
              {multiAgentMode && !autopilotMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -4 }} 
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 mb-2.5 text-[11px] text-primary/75 font-semibold"
                >
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-3.5 h-3.5 rounded-full bg-primary/25 border border-primary/40 flex items-center justify-center"
                  >
                    <Zap className="w-2 h-2 text-primary/90" />
                  </motion.div>
                  Multi-Agent Swarm — up to 4 specialists running in parallel
                </motion.div>
              )}
              {autopilotMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 mb-2.5 text-[11px] text-cyan-300/80 font-semibold"
                >
                  <motion.div
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-3.5 h-3.5 rounded-full bg-cyan-500/20 border border-cyan-500/35 flex items-center justify-center"
                  >
                    <Bot className="w-2 h-2 text-cyan-300/90" />
                  </motion.div>
                  Autopilot — 30-step autonomous loop with self-critique &amp; memory
                </motion.div>
              )}
              </AnimatePresence>

              {/* Input box with gradient border */}
              <div className={cn(
                "relative rounded-2xl",
                multiAgentMode
                  ? "p-px bg-gradient-to-r from-primary/60 via-violet-500/35 to-cyan-500/30 shadow-[0_0_24px_hsl(260_84%_63%/0.2)]"
                  : "p-px bg-gradient-to-r from-white/15 to-white/8 shadow-[0_0_12px_hsl(260_84%_63%/0.08)]"
              )}>
                <div className="relative bg-gradient-to-b from-[hsl(228_22%_7.5%)] to-[hsl(228_22%_6%)] rounded-2xl flex items-end gap-2 px-4 py-3 backdrop-blur-sm">
                  <motion.textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      multiAgentMode
                        ? "Deploy agents to... (e.g. Research, analyze and report on AI trends)"
                        : "Give Zanix a goal..."
                    }
                    rows={inputRows}
                    className="flex-1 bg-transparent text-white/90 placeholder:text-white/20 text-sm py-1 resize-none outline-none leading-relaxed transition-colors duration-200"
                    style={{ maxHeight: "160px" }}
                    animate={{ 
                      borderColor: input.trim() ? "hsl(260, 84%, 75%)" : "transparent",
                      boxShadow: input.trim() ? "0 0 8px hsl(260, 84%, 63%, 0.1) inset" : "none"
                    }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.button
                    whileHover={input.trim() && !isPending ? { scale: 1.1 } : {}} 
                    whileTap={input.trim() && !isPending ? { scale: 0.88 } : {}}
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isPending}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5",
                      input.trim() && !isPending
                        ? "bg-primary hover:bg-primary/85 text-white shadow-[0_0_20px_hsl(260_84%_63%/0.4)] glow-effect"
                        : "bg-white/4 text-white/15 cursor-not-allowed"
                    )}
                  >
                    {isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </motion.button>
                </div>
              </div>

              <p className="text-center text-[10px] text-white/14 mt-2 font-medium tracking-wide">
                Enter to send &nbsp;·&nbsp; Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Canvas / Autopilot Panel ─────────────────────── */}
      <AnimatePresence>
        {canvasOpen && (
          <CanvasPanel
            tasks={autopilotTasks}
            onRefresh={fetchAutopilotTasks}
            isRefreshing={canvasRefreshing}
            onClose={() => setCanvasOpen(false)}
          />
        )}
      </AnimatePresence>

      </div>
    </div>
  );
}
