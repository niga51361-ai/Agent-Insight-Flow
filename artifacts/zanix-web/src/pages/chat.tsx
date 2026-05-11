import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Plus, MessageSquare, LogOut, Menu,
  Code2, ChevronDown, Globe, Zap,
  Workflow, Sparkles, Paperclip, Mic, MicOff,
  X, ChevronUp, Search, FileText, Brain,
  Settings, Layers, Shield, Square,
  File as FileIcon,
} from "lucide-react";
import {
  useGetMe, useLogout, useCreateSession, useListSessions,
  useOrchestrateSync,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import ZanixLogo from "@/components/zanix-logo";
import { MODELS } from "@/components/chat/types";
import type { TraceStep, Attachment, Message } from "@/components/chat/types";
import { MessageRow } from "@/components/chat/MessageRow";
import { SettingsPanel } from "@/components/chat/SettingsPanel";

// ─── Attachment preview chip ──────────────────────────────────────
function AttachChip({ att, onRemove }: { att: Attachment; onRemove?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 4 }}
      transition={{ duration: 0.18 }}
      className="relative group/chip shrink-0"
    >
      {att.type === "image" ? (
        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/12 bg-white/5">
          <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 border border-white/20 flex items-center justify-center opacity-0 group-hover/chip:opacity-100 transition-opacity"
            >
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

// ─── Session Item ─────────────────────────────────────────────────
function SessionItem({ session, isActive, onClick }: { session: any; isActive: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ x: -2 }} onClick={onClick}
      className={cn(
        "w-full text-right flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group border",
        isActive
          ? "bg-primary/10 border-primary/20 text-white"
          : "border-transparent text-white/40 hover:text-white/70 hover:bg-white/4"
      )}
    >
      <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-white/20 group-hover:text-white/40")} />
      <span className="text-xs font-medium truncate flex-1">{session.title || "محادثة جديدة"}</span>
      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
    </motion.button>
  );
}

// ─── Sidebar Content ──────────────────────────────────────────────
function SidebarContent({ user, sessions, currentSessionId, onNewChat, onSelectSession, onLogout, onIntegrations, onSettings, onAdmin }: {
  user: any; sessions: any[]; currentSessionId: string | null;
  onNewChat: () => void; onSelectSession: (id: string) => void;
  onLogout: () => void; onIntegrations: () => void; onSettings: () => void; onAdmin: () => void;
}) {
  return (
    <>
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

      <div className="p-3 shrink-0">
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary/15 to-violet-600/8 border border-primary/22 text-primary text-xs font-bold hover:from-primary/22 hover:to-violet-600/14 transition-all shadow-[0_0_16px_hsl(260_84%_63%/0.1)]"
        >
          <Plus className="w-4 h-4" />
          محادثة جديدة
        </motion.button>
      </div>

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

      <div className="p-3 border-t border-white/6 space-y-1 shrink-0">
        <button onClick={onSettings} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/4 transition-all text-xs">
          <Settings className="w-3.5 h-3.5" /><span>الإعدادات</span>
        </button>
        <button onClick={onIntegrations} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/4 transition-all text-xs">
          <Layers className="w-3.5 h-3.5" /><span>التكاملات</span>
        </button>
        {user?.role === "admin" && (
          <button onClick={onAdmin} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/8 transition-all text-xs border border-transparent hover:border-amber-500/15">
            <Shield className="w-3.5 h-3.5" /><span>لوحة الإدارة</span>
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
  const current = MODELS.find((m) => m.id === model) ?? MODELS[0];

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/7 hover:border-white/14 transition-all text-[11px] font-semibold text-white/50 hover:text-white/75"
      >
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", current.dot)} />
        <span className="hidden sm:block max-w-[70px] truncate">{current.label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-full mb-2 right-0 w-44 bg-[hsl(228_25%_7%)] border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-50"
          >
            <div className="p-1.5 space-y-0.5">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-right",
                    model === m.id ? "bg-white/8 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/4"
                  )}
                >
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

// ─── Suggestions ─────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: <Search className="w-4 h-4" />,  title: "ابحث في الويب",  sub: "أحدث أخبار الذكاء الاصطناعي", color: "from-blue-500/12 to-cyan-500/6",   border: "border-blue-500/18",   iconBg: "bg-blue-500/12 text-blue-400" },
  { icon: <Code2  className="w-4 h-4" />,  title: "اكتب كوداً",    sub: "Python، JS، أي لغة تريدها",   color: "from-violet-500/12 to-purple-500/6", border: "border-violet-500/18", iconBg: "bg-violet-500/12 text-violet-400" },
  { icon: <FileText className="w-4 h-4" />,title: "اكتب تقريراً",  sub: "محتوى احترافي جاهز للنشر",     color: "from-emerald-500/12 to-cyan-500/6",  border: "border-emerald-500/18",iconBg: "bg-emerald-500/12 text-emerald-400" },
  { icon: <Brain  className="w-4 h-4" />,  title: "اشرح مفهوماً",  sub: "بأسلوب بسيط وواضح",           color: "from-pink-500/12 to-rose-500/6",     border: "border-pink-500/18",   iconBg: "bg-pink-500/12 text-pink-400" },
];

const PROMPTS = [
  "ابحث عن آخر أخبار الذكاء الاصطناعي وأعطني ملخصاً",
  "اكتب كود Python لتحليل ملف CSV وإنشاء مخططات بيانية",
  "اكتب لي تقريراً احترافياً عن الذكاء الاصطناعي في الأعمال",
  "فسّر لي كيف تعمل الشبكات العصبية العميقة",
];

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ onSelectSuggestion }: { onSelectSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pt-6 pb-4 sm:py-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative text-center w-full max-w-lg"
      >
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, delay: 0.05 }}
          className="relative inline-flex mb-5"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/20 to-violet-600/10 border border-primary/25 flex items-center justify-center shadow-[0_0_50px_hsl(260_84%_63%/0.15),0_0_0_1px_hsl(260_84%_63%/0.08)]">
            <ZanixLogo size={36} />
          </div>
          <motion.div
            animate={{ scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: 9999 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[hsl(228_22%_4%)] shadow-[0_0_8px_hsl(160_84%_39%/0.7)]"
          >
            <div className="w-full h-full rounded-full bg-emerald-400" />
          </motion.div>
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1.5"
        >
          كيف يمكنني مساعدتك؟
        </motion.h2>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
          className="text-white/35 text-xs sm:text-sm mb-6 sm:mb-7 leading-relaxed max-w-sm mx-auto"
        >
          ابحث في الويب، اكتب الكود، حلّل البيانات، وأنجز مهامك المعقدة
        </motion.p>

        <div className="relative w-full max-w-lg mx-auto">
          <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar px-1">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i + 0.28 }}
                whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                onClick={() => onSelectSuggestion(PROMPTS[i]!)}
                className={cn(
                  "flex-shrink-0 w-40 sm:w-44 flex flex-col items-start gap-2.5 px-3.5 py-3.5 rounded-2xl bg-gradient-to-br border text-right transition-all group snap-start",
                  s.color, s.border, "hover:shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                )}
              >
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

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="flex flex-wrap items-center justify-center gap-2 mt-6"
        >
          {[
            { icon: <Globe className="w-3 h-3" />,    label: "بحث ويب" },
            { icon: <Code2 className="w-3 h-3" />,    label: "كتابة كود" },
            { icon: <Zap className="w-3 h-3" />,      label: "٢١ أداة" },
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

  const { data: meData }        = useGetMe();
  const logoutMutation          = useLogout();
  const createSessionMutation   = useCreateSession();
  const { data: sessionsData }  = useListSessions();
  const orchestrateMutation     = useOrchestrateSync();

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

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const handler = () => setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { if (!showScrollBtn) scrollToBottom(); }, [messages.length, showScrollBtn]);
  useEffect(() => { if (meData && !user) setLocation("/auth"); }, [meData]);

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
      liveStepsRef.current = [
        ...liveStepsRef.current.filter((s) => s.stepIndex !== step.stepIndex),
        step,
      ].sort((a, b) => a.stepIndex - b.stepIndex);
      setLiveSteps([...liveStepsRef.current]);
    });

    sse.addEventListener("done", (e) => {
      const data = JSON.parse(e.data);
      setIsRunning(false);
      setActiveSseTaskId(null);
      sse.close();
      const finalSteps = [...liveStepsRef.current];
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: data.result ?? m.content, isStreaming: false, steps: finalSteps, tokensUsed: data.tokensUsed }
            : m
        )
      );
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
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SpeechRecognitionCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor() as any;
    rec.lang = "ar-SA"; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = (event: any) => {
      const transcript = Array.from(event.results as any[]).map((r: any) => r[0].transcript).join("");
      setInput(transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    files.forEach((file) => {
      if (file.size > 15 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAttachedFiles((prev) => [...prev, {
          id: crypto.randomUUID(), name: file.name,
          type: file.type.startsWith("image/") ? "image" : "file",
          dataUrl, mimeType: file.type, size: file.size,
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
    setInput(""); setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, attachments: currentAttachments, createdAt: new Date() };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", isStreaming: true, createdAt: new Date() };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsRunning(true); setLiveSteps([]);

    try {
      const sid = await ensureSession();
      const imageDataUrls = currentAttachments.filter((a) => a.type === "image").map((a) => a.dataUrl);
      const fileContextParts = currentAttachments.filter((a) => a.type === "file").map((a) => `[ملف مرفق: ${a.name}]`);
      const fullGoal = [text, ...fileContextParts].filter(Boolean).join("\n");

      if (useOrchestrate) {
        const res = await orchestrateMutation.mutateAsync({ data: { sessionId: sid, goal: fullGoal, maxAgents: 4 } }) as any;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: res.finalAnswer ?? "اكتمل التنسيق.", isStreaming: false, subResults: res.subResults, tokensUsed: res.totalTokensUsed }
              : m
          )
        );
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
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, taskId } : m));
        connectSSE(taskId, assistantId);
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: "", isStreaming: false, error: err?.message ?? "حدث خطأ غير متوقع." } : m)
      );
      setIsRunning(false);
    }
  };

  const stopAgent = () => {
    sseRef.current?.close();
    setIsRunning(false); setActiveSseTaskId(null);
    setMessages((prev) => prev.map((m) => m.isStreaming ? { ...m, isStreaming: false, content: m.content || "تم إيقاف الوكيل." } : m));
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

      {/* ── Settings Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div key="settings-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]" />
            <motion.div key="settings-panel"
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-4 sm:inset-8 md:inset-12 lg:inset-16 xl:inset-24 bg-[hsl(228_22%_5%)] border border-white/8 rounded-3xl z-[70] flex flex-col overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
              onClick={(e) => e.stopPropagation()}
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

      {/* ── Mobile Sidebar ──────────────────────────────────────── */}
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

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside key="sidebar"
            initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="hidden md:flex flex-col border-l border-white/6 bg-white/[0.015] overflow-hidden shrink-0"
          >
            <SidebarContent
              user={user} sessions={sessions} currentSessionId={currentSessionId}
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

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Topbar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/6 bg-[hsl(228_22%_5%)]/80 backdrop-blur-xl shrink-0 z-10">
          <button onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white/75 hover:bg-white/6 transition-all shrink-0">
            <Menu className="w-4 h-4" />
          </button>
          <button onClick={() => setSidebarOpen((p) => !p)}
            className="hidden md:flex w-8 h-8 rounded-xl items-center justify-center text-white/35 hover:text-white/75 hover:bg-white/6 transition-all shrink-0">
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/55 truncate">{chatTitle}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setUseOrchestrate((p) => !p)}
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all",
                useOrchestrate
                  ? "bg-violet-500/12 border-violet-500/25 text-violet-300"
                  : "bg-white/4 border-white/8 text-white/35 hover:text-white/65"
              )}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span className="hidden lg:block">{useOrchestrate ? "تعدد وكلاء" : "وكيل واحد"}</span>
            </button>
          </div>
        </div>

        {/* ── Messages ────────────────────────────────────────── */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            <EmptyState onSelectSuggestion={(text) => { setInput(text); setTimeout(() => textareaRef.current?.focus(), 50); }} />
          ) : (
            <div className="max-w-3xl mx-auto w-full py-4 sm:py-6 pb-2 space-y-0">
              {messages.map((msg) => (
                <MessageRow key={msg.id} msg={msg} liveSteps={liveSteps} activeSseTaskId={activeSseTaskId} />
              ))}
              <div ref={bottomRef} className="h-6" />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 8 }}
              onClick={scrollToBottom}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[hsl(228_22%_9%)] border border-white/14 flex items-center justify-center text-white/50 hover:text-white hover:bg-[hsl(228_22%_12%)] transition-all shadow-lg z-20"
            >
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
              <AnimatePresence>
                {attachedFiles.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="flex flex-wrap gap-2 px-4 pt-3 pb-0 overflow-hidden"
                  >
                    {attachedFiles.map((att) => (
                      <AttachChip key={att.id} att={att} onRemove={() => setAttachedFiles((p) => p.filter((a) => a.id !== att.id))} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <textarea
                ref={textareaRef} value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRunning ? "الوكيل يعمل…" : "اكتب رسالتك… (أو أرسل صورة 🖼️)"}
                disabled={isRunning} rows={1} dir="auto"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/22 resize-none focus:outline-none leading-relaxed px-4 pt-3.5 pb-2 min-h-[50px] max-h-[140px] disabled:opacity-40"
              />

              <div className="flex items-center justify-between px-2.5 sm:px-3 pb-2.5 gap-2">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <input
                    ref={fileInputRef} type="file" multiple
                    accept="image/*,.pdf,.txt,.md,.csv,.js,.ts,.py,.json,.html,.css"
                    onChange={handleFileSelect} className="hidden"
                  />
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => fileInputRef.current?.click()} disabled={isRunning}
                    title="إرفاق صورة أو ملف"
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-0",
                      attachedFiles.length > 0 ? "text-primary bg-primary/10 border border-primary/20" : "text-white/30 hover:text-white/65 hover:bg-white/6"
                    )}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
                    onClick={toggleListening} disabled={isRunning}
                    title={isListening ? "إيقاف الاستماع" : "إدخال صوتي"}
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-0",
                      isListening ? "text-red-400 bg-red-500/12 border border-red-500/25 animate-pulse" : "text-white/25 hover:text-white/55 hover:bg-white/6"
                    )}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </motion.button>
                  <ModelSelector model={selectedModel} setModel={setSelectedModel} />
                </div>

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
                    <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
                      onClick={sendMessage}
                      disabled={!input.trim() && attachedFiles.length === 0}
                      className={cn(
                        "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all",
                        (input.trim() || attachedFiles.length > 0)
                          ? "bg-gradient-to-br from-primary to-violet-600 text-white shadow-[0_2px_18px_hsl(260_84%_63%/0.45)]"
                          : "bg-white/5 text-white/15 cursor-not-allowed"
                      )}
                    >
                      <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>

            <p className="hidden sm:block text-center text-[10px] text-white/12 mt-1.5 select-none">
              {useOrchestrate
                ? <span className="flex items-center justify-center gap-1"><Sparkles className="w-3 h-3 text-violet-400/60" /> وضع تعدد الوكلاء — حتى ٦ وكلاء متوازية</span>
                : <span>Enter للإرسال · Shift+Enter لسطر جديد · {MODELS.find((m) => m.id === selectedModel)?.label}</span>
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
