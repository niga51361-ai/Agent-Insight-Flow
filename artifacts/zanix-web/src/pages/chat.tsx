import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Plus, MessageSquare, LogOut, Loader2, Menu,
  Terminal, Search, BarChart3, Hammer, FileText, Database, Brain,
  ChevronDown, Copy, Check, Cpu, Activity,
  Globe, Code2, Image, AlertCircle, Layers,
  PanelRight, PanelRightClose,
  ChevronLeft, Lightbulb, Eye, Wrench, Atom, Zap
} from "lucide-react";
import {
  useGetMe, useLogout, useCreateSession, useListSessions,
  useOrchestrateSync,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import ZanixLogo from "@/components/zanix-logo";

// ─── Types ────────────────────────────────────────────────────────
interface TraceStep {
  stepIndex: number;
  type: string;
  thought?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  observation?: string;
  status: "pending" | "running" | "completed" | "failed";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: TraceStep[];
  isStreaming?: boolean;
  taskId?: string;
  tokensUsed?: number;
  subResults?: any[];
  error?: string;
  createdAt: Date;
}

// ─── Step type config ─────────────────────────────────────────────
function StepIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5";
  if (type === "think") return <Lightbulb className={cls} />;
  if (type === "search") return <Search className={cls} />;
  if (type === "browse") return <Globe className={cls} />;
  if (type === "code") return <Code2 className={cls} />;
  if (type === "shell") return <Terminal className={cls} />;
  if (type === "write_file") return <FileText className={cls} />;
  if (type === "read_file") return <Eye className={cls} />;
  if (type === "done") return <Check className={cls} />;
  return <Wrench className={cls} />;
}

function stepColors(type: string) {
  if (type === "think") return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
  if (type === "search") return { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" };
  if (type === "browse") return { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" };
  if (type === "code" || type === "shell") return { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" };
  if (type === "write_file" || type === "read_file") return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
  if (type === "done") return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
  return { text: "text-white/50", bg: "bg-white/5", border: "border-white/10" };
}

const STEP_LABELS: Record<string, string> = {
  think: "تفكير", search: "بحث", browse: "تصفح", code: "كود",
  shell: "طرفية", write_file: "كتابة ملف", read_file: "قراءة ملف", done: "اكتمل",
};

// ─── Copy button ──────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); }}
      className={cn("p-1.5 rounded-lg transition-all", ok ? "bg-emerald-500/15 text-emerald-400" : "text-white/30 hover:text-white/70 hover:bg-white/8")}
    >
      {ok ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Execution Trace Panel ────────────────────────────────────────
function ExecutionTrace({ steps, isRunning }: { steps: TraceStep[]; isRunning: boolean }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [steps.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/6 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white">مسار التنفيذ</p>
          <p className="text-[10px] text-white/35">{steps.length} خطوة</p>
        </div>
        {isRunning && (
          <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-emerald-400" />
        )}
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {steps.length === 0 && !isRunning && (
          <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
            <Atom className="w-8 h-8 text-white/10" />
            <p className="text-xs text-white/20">في انتظار الوكيل...</p>
          </div>
        )}
        {isRunning && steps.length === 0 && (
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-primary/8 border border-primary/20">
            <div className="w-4 h-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
            <span className="text-xs text-primary/80">الوكيل يفكر...</span>
          </motion.div>
        )}

        <AnimatePresence>
          {steps.map((step, i) => {
            const c = stepColors(step.type);
            const isExp = !!expanded[i];
            const hasDetail = step.thought || step.toolName || step.observation;
            return (
              <motion.div key={i} initial={{ opacity: 0, x: 10, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                <button
                  onClick={() => hasDetail && setExpanded(p => ({ ...p, [i]: !p[i] }))}
                  className={cn("w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left", c.bg, c.border, hasDetail && "hover:opacity-90 cursor-pointer")}
                >
                  <div className={cn("w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border", c.bg, c.border)}>
                    <span className={c.text}><StepIcon type={step.type} /></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider", c.text)}>
                        {STEP_LABELS[step.type] ?? step.toolName ?? step.type}
                      </span>
                      {hasDetail && <ChevronDown className={cn("w-3 h-3 text-white/30 transition-transform shrink-0", isExp && "rotate-180")} />}
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2">
                      {step.thought?.slice(0, 80) || step.toolName || "..."}
                    </p>
                  </div>
                </button>

                <AnimatePresence>
                  {isExp && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="mx-2 mb-1.5 p-3 rounded-xl bg-black/25 border border-white/6 space-y-2.5 text-[11px]">
                        {step.thought && (
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">💭 تفكير</p>
                            <p className="text-white/60 italic leading-relaxed">{step.thought}</p>
                          </div>
                        )}
                        {step.toolName && (
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">🔧 أداة</p>
                            <span className="font-mono text-violet-300 bg-violet-500/12 px-2 py-0.5 rounded border border-violet-500/20 text-[10px]">
                              {step.toolName}
                            </span>
                          </div>
                        )}
                        {step.toolInput && Object.keys(step.toolInput).length > 0 && (
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">📥 مدخلات</p>
                            <pre className="text-white/45 bg-black/30 rounded-lg p-2 overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap">
                              {JSON.stringify(step.toolInput, null, 2)}
                            </pre>
                          </div>
                        )}
                        {step.observation && (
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">📤 نتيجة</p>
                            <p className="text-white/50 leading-relaxed line-clamp-8">{step.observation}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isRunning && steps.length > 0 && (
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/3 border border-white/8">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] text-white/35">معالجة الخطوة التالية...</span>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────
function MessageBubble({ msg, onShowTrace, activeTraceId }: {
  msg: Message;
  onShowTrace: (id: string) => void;
  activeTraceId: string | null;
}) {
  const isUser = msg.role === "user";
  const hasSteps = (msg.steps?.length ?? 0) > 0 || msg.isStreaming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex gap-3 px-5 py-2 group", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/15 border border-primary/25 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_12px_hsl(260_84%_63%/0.15)]">
          <ZanixLogo size={18} />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[80%]", isUser ? "items-end" : "items-start")}>
        {/* Bubble */}
        <div className={cn(
          "relative rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-white rounded-tr-md shadow-[0_4px_16px_hsl(260_84%_63%/0.28)]"
            : "bg-white/[0.06] border border-white/8 text-white/90 rounded-tl-md"
        )}>
          {msg.isStreaming && !msg.content ? (
            <div className="flex items-center gap-1.5 py-0.5">
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              ))}
            </div>
          ) : (
            <div className={cn("prose prose-sm max-w-none", isUser ? "prose-invert prose-p:text-white" : "prose-invert")}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children }) {
                    const isBlock = !!className?.includes("language-");
                    if (isBlock) {
                      return (
                        <div className="relative group/code my-2">
                          <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                            <CopyBtn text={String(children)} />
                          </div>
                          <pre className="bg-black/40 rounded-xl p-4 overflow-x-auto border border-white/8 text-[12px] leading-relaxed">
                            <code className={className}>{children}</code>
                          </pre>
                        </div>
                      );
                    }
                    return <code className="bg-white/10 px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code>;
                  },
                  table({ children }) {
                    return <div className="overflow-x-auto"><table className="border-collapse w-full text-xs">{children}</table></div>;
                  },
                  th({ children }) { return <th className="border border-white/10 px-3 py-2 bg-white/5 font-semibold text-left">{children}</th>; },
                  td({ children }) { return <td className="border border-white/8 px-3 py-2">{children}</td>; },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn("flex items-center gap-2 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity", isUser ? "flex-row-reverse" : "flex-row")}>
          <span className="text-[10px] text-white/20">
            {msg.createdAt.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && <CopyBtn text={msg.content} />}
          {!isUser && hasSteps && msg.taskId && (
            <button
              onClick={() => onShowTrace(msg.taskId!)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border",
                activeTraceId === msg.taskId
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
              )}
            >
              <Activity className="w-3 h-3" />
              {msg.steps?.length ?? 0} خطوة
            </button>
          )}
          {!isUser && msg.tokensUsed && (
            <span className="flex items-center gap-1 text-[10px] text-white/20">
              <Cpu className="w-3 h-3" /> {msg.tokensUsed.toLocaleString()}
            </span>
          )}
        </div>

        {msg.error && (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {msg.error}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sidebar session item ─────────────────────────────────────────
function SessionItem({ session, isActive, onClick }: { session: any; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group border",
        isActive
          ? "bg-primary/10 border-primary/20 text-white"
          : "border-transparent text-white/45 hover:text-white/75 hover:bg-white/4"
      )}
    >
      <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-white/25 group-hover:text-white/45")} />
      <span className="text-xs font-medium truncate">{session.title || "جلسة جديدة"}</span>
    </button>
  );
}

// ─── Suggestions ─────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: <Globe className="w-4 h-4" />, text: "ابحث عن آخر أخبار الذكاء الاصطناعي" },
  { icon: <Code2 className="w-4 h-4" />, text: "اكتب كود Python لتحليل CSV" },
  { icon: <BarChart3 className="w-4 h-4" />, text: "حلل بياناتي وقدم توصيات" },
  { icon: <FileText className="w-4 h-4" />, text: "اكتب تقريرًا تقنيًا احترافيًا" },
  { icon: <Brain className="w-4 h-4" />, text: "شرح مفهوم الشبكات العصبية" },
  { icon: <Zap className="w-4 h-4" />, text: "ابنِ لي موقعًا بسيطًا بـ HTML" },
];

// ─── Main Chat Page ───────────────────────────────────────────────
export default function ChatPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const sessionId = (params as any)?.sessionId as string | undefined;

  const { data: meData } = useGetMe();
  const logoutMutation = useLogout();
  const createSessionMutation = useCreateSession();
  const { data: sessionsData } = useListSessions();
  const orchestrateMutation = useOrchestrateSync();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId ?? null);
  const [isRunning, setIsRunning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [traceOpen, setTraceOpen] = useState(false);
  const [activeTraceTaskId, setActiveTraceTaskId] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<TraceStep[]>([]);
  const [activeSseTaskId, setActiveSseTaskId] = useState<string | null>(null);
  const [useOrchestrate, setUseOrchestrate] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const liveStepsRef = useRef<TraceStep[]>([]);

  const user = (meData as any)?.user;
  const sessions = (sessionsData as any)?.sessions ?? [];

  const traceSteps = activeTraceTaskId === activeSseTaskId
    ? liveSteps
    : (messages.find(m => m.taskId === activeTraceTaskId)?.steps ?? []);
  const isLiveRunning = activeTraceTaskId === activeSseTaskId && isRunning;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (meData && !user) setLocation("/auth"); }, [meData]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  const handleShowTrace = useCallback((taskId: string) => {
    setActiveTraceTaskId(taskId);
    setTraceOpen(true);
  }, []);

  const connectSSE = useCallback((taskId: string, assistantMsgId: string) => {
    sseRef.current?.close();
    setActiveSseTaskId(taskId);
    setActiveTraceTaskId(taskId);
    setLiveSteps([]);
    liveStepsRef.current = [];
    setTraceOpen(true);

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

    sse.onerror = () => {
      setIsRunning(false);
      setActiveSseTaskId(null);
      sse.close();
    };
  }, []);

  const ensureSession = async () => {
    if (currentSessionId) return currentSessionId;
    const res = await createSessionMutation.mutateAsync({ data: {} });
    const sid = (res as any).session?.sessionId;
    if (sid) { setCurrentSessionId(sid); setLocation(`/chat/${sid}`); }
    return sid;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isRunning) return;
    setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, createdAt: new Date() };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", isStreaming: true, createdAt: new Date() };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsRunning(true);
    setLiveSteps([]);

    try {
      const sid = await ensureSession();

      if (useOrchestrate) {
        const res = await orchestrateMutation.mutateAsync({ data: { sessionId: sid, goal: text, maxAgents: 4 } }) as any;
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
          body: JSON.stringify({ sessionId: sid, goal: text }),
          credentials: "include",
        });
        if (!startRes.ok) throw new Error(`فشل الاتصال: ${startRes.status}`);
        const { taskId } = await startRes.json();
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, taskId } : m));
        connectSSE(taskId, assistantId);
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: "", isStreaming: false, error: err?.message ?? "حدث خطأ." } : m
      ));
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const newChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setActiveTraceTaskId(null);
    setLiveSteps([]);
    setTraceOpen(false);
    setLocation("/chat");
  };

  return (
    <div className="flex h-screen bg-[hsl(228_22%_4%)] text-white overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 252, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col border-r border-white/6 bg-white/[0.018] overflow-hidden shrink-0"
          >
            {/* Brand */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-white/6 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/22 flex items-center justify-center shadow-[0_0_20px_hsl(260_84%_63%/0.18)]">
                <ZanixLogo size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-tight">Zanix AI</p>
                <p className="text-[10px] text-white/28">الوكيل الذكي المتكامل</p>
              </div>
            </div>

            {/* New chat button */}
            <div className="p-3 shrink-0">
              <button onClick={newChat} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/15 transition-all">
                <Plus className="w-4 h-4" />
                محادثة جديدة
              </button>
            </div>

            {/* Sessions */}
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
              {sessions.length > 0 && (
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-3 pt-1 pb-2">الأخيرة</p>
              )}
              {sessions.map((s: any) => (
                <SessionItem key={s.sessionId} session={s} isActive={s.sessionId === currentSessionId}
                  onClick={() => { setCurrentSessionId(s.sessionId); setLocation(`/chat/${s.sessionId}`); }} />
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/6 space-y-1 shrink-0">
              <button onClick={() => setLocation("/integrations")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/35 hover:text-white/65 hover:bg-white/4 transition-all text-xs">
                <Layers className="w-3.5 h-3.5" /> التكاملات
              </button>
              {user && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/3 border border-white/6">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {(user.name ?? user.email ?? "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/75 truncate">{user.name ?? user.email}</p>
                    <p className="text-[10px] text-white/28 truncate">{user.email}</p>
                  </div>
                  <button onClick={() => logoutMutation.mutateAsync().then(() => setLocation("/"))} className="text-white/22 hover:text-red-400 transition-colors p-1">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main area ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Topbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6 bg-[hsl(228_22%_4%)] shrink-0 z-10">
          <button onClick={() => setSidebarOpen(p => !p)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white/75 hover:bg-white/6 transition-all">
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/65 truncate">
              {messages.length === 0 ? "محادثة جديدة" : messages[0].content.slice(0, 50)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <button onClick={() => setUseOrchestrate(p => !p)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all",
                useOrchestrate
                  ? "bg-violet-500/12 border-violet-500/25 text-violet-300"
                  : "bg-white/4 border-white/8 text-white/35 hover:text-white/65"
              )}>
              <Cpu className="w-3.5 h-3.5" />
              {useOrchestrate ? "تعدد وكلاء" : "وكيل واحد"}
            </button>

            {/* Trace toggle */}
            <button onClick={() => setTraceOpen(p => !p)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all",
                traceOpen
                  ? "bg-primary/12 border-primary/25 text-primary"
                  : "bg-white/4 border-white/8 text-white/35 hover:text-white/65"
              )}>
              {traceOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
              مسار التنفيذ
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center max-w-xl w-full">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/15 to-cyan-500/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_hsl(260_84%_63%/0.12)]">
                  <ZanixLogo size={44} />
                </div>
                <h2 className="text-2xl font-display font-bold text-white mb-2">كيف يمكنني مساعدتك؟</h2>
                <p className="text-white/35 text-sm mb-8 leading-relaxed">
                  وكيل ذكاء اصطناعي متكامل يبحث ويحلل ويكتب الكود ويبني المشاريع تلقائيًا
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}
                      className="flex items-center gap-2 px-3 py-3 rounded-xl bg-white/3 border border-white/7 text-left hover:bg-white/6 hover:border-white/14 transition-all group text-xs text-white/50 hover:text-white/80">
                      <span className="text-primary/60 group-hover:text-primary/90 transition-colors shrink-0">{s.icon}</span>
                      {s.text}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full py-6 space-y-0.5">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onShowTrace={handleShowTrace} activeTraceId={activeTraceTaskId} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-4 border-t border-white/6">
          <div className="max-w-3xl mx-auto">
            <div className={cn(
              "relative flex items-end gap-3 px-4 py-3 rounded-2xl border transition-all duration-200",
              isRunning
                ? "border-primary/25 bg-primary/4"
                : "border-white/9 bg-white/[0.04] focus-within:border-primary/35 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_3px_hsl(260_84%_63%/0.06)]"
            )}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRunning ? "الوكيل يعمل الآن..." : "اكتب رسالتك... (Enter للإرسال، Shift+Enter لسطر جديد)"}
                disabled={isRunning}
                rows={1}
                dir="auto"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/22 resize-none focus:outline-none leading-relaxed min-h-[24px] max-h-[160px] disabled:opacity-40"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isRunning}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0",
                  input.trim() && !isRunning
                    ? "bg-primary text-white hover:bg-primary/88 shadow-[0_2px_14px_hsl(260_84%_63%/0.38)]"
                    : "bg-white/6 text-white/18 cursor-not-allowed"
                )}
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-center text-[10px] text-white/14 mt-2">
              Zanix AI · {useOrchestrate ? "وضع تعدد الوكلاء ⚡" : "وضع الوكيل الذكي"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Execution Trace Panel ──────────────────────── */}
      <AnimatePresence initial={false}>
        {traceOpen && (
          <motion.aside
            key="trace"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col border-l border-white/6 bg-white/[0.018] overflow-hidden shrink-0"
          >
            <ExecutionTrace steps={traceSteps} isRunning={isLiveRunning} />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
