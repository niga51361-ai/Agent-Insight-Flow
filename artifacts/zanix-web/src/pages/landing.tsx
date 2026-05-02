import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import {
  Globe, Code2, Hammer, BarChart3, Zap, Sparkles, X, Mail, Lock,
  User, ArrowRight, Check, Terminal, Search, Database, Brain,
  FileText, Cpu, Network, Shield, ChevronDown, Bot, Play,
  MousePointer2, Layers, Activity
} from "lucide-react";
import { useGetMe, useLogin, useRegister } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import ZanixLogo from "@/components/zanix-logo";

// ── Language translations ──────────────────────────────────────────
const LANGS = {
  en: {
    code: "en", label: "English", flag: "🇺🇸", dir: "ltr" as const,
    badge: "Multi-Agent Swarm Orchestration — Live",
    headline1: "The AI Agent That", headline2: "Actually Ships",
    subtitlePre: "Zanix is an autonomous AI agent with",
    toolsLabel: "21 professional tools",
    subtitlePost: ". It searches the web, writes and runs code, builds websites, and completes complex multi-step tasks — all without you lifting a finger.",
    navItems: ["Features", "Agents", "Pricing"],
    ctaStart: "Start Free", ctaSignIn: "Sign In", ctaOpenChat: "Open Chat",
    scroll: "Scroll",
  },
  ar: {
    code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" as const,
    badge: "تنسيق أسراب الوكلاء — مباشر",
    headline1: "الوكيل الذكي الذي", headline2: "يُنجز المهام فعلاً",
    subtitlePre: "زانيكس وكيل ذكاء اصطناعي مستقل مزوّد بـ",
    toolsLabel: "٢١ أداة احترافية",
    subtitlePost: "، يبحث في الويب ويكتب وينفّذ الكود ويبني المواقع وينجز المهام المعقدة — دون أي تدخّل منك.",
    navItems: ["المميزات", "الوكلاء", "الأسعار"],
    ctaStart: "ابدأ مجاناً", ctaSignIn: "تسجيل الدخول", ctaOpenChat: "فتح المحادثة",
    scroll: "مرر",
  },
  fr: {
    code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" as const,
    badge: "Orchestration Multi-Agents — En Direct",
    headline1: "L'Agent IA Qui", headline2: "Livre Vraiment",
    subtitlePre: "Zanix est un agent IA autonome avec",
    toolsLabel: "21 outils professionnels",
    subtitlePost: ". Il recherche sur le web, écrit du code, crée des sites et accomplit des tâches complexes — sans que vous ayez à lever le petit doigt.",
    navItems: ["Fonctionnalités", "Agents", "Tarifs"],
    ctaStart: "Commencer", ctaSignIn: "Connexion", ctaOpenChat: "Ouvrir le Chat",
    scroll: "Défiler",
  },
  es: {
    code: "es", label: "Español", flag: "🇪🇸", dir: "ltr" as const,
    badge: "Orquestación Multi-Agente — En Vivo",
    headline1: "El Agente IA Que", headline2: "Realmente Entrega",
    subtitlePre: "Zanix es un agente IA autónomo con",
    toolsLabel: "21 herramientas profesionales",
    subtitlePost: ". Busca en la web, escribe y ejecuta código, crea sitios web y completa tareas complejas — sin que tengas que hacer nada.",
    navItems: ["Características", "Agentes", "Precios"],
    ctaStart: "Empezar Gratis", ctaSignIn: "Iniciar Sesión", ctaOpenChat: "Abrir Chat",
    scroll: "Desplazar",
  },
  de: {
    code: "de", label: "Deutsch", flag: "🇩🇪", dir: "ltr" as const,
    badge: "Multi-Agenten-Orchestrierung — Live",
    headline1: "Der KI-Agent Der", headline2: "Wirklich Liefert",
    subtitlePre: "Zanix ist ein autonomer KI-Agent mit",
    toolsLabel: "21 professionellen Tools",
    subtitlePost: ". Er durchsucht das Web, schreibt und führt Code aus, erstellt Websites und erledigt komplexe Aufgaben — ohne dass Sie einen Finger rühren müssen.",
    navItems: ["Funktionen", "Agenten", "Preise"],
    ctaStart: "Kostenlos starten", ctaSignIn: "Anmelden", ctaOpenChat: "Chat öffnen",
    scroll: "Scrollen",
  },
  pt: {
    code: "pt", label: "Português", flag: "🇵🇹", dir: "ltr" as const,
    badge: "Orquestração Multi-Agente — Ao Vivo",
    headline1: "O Agente IA Que", headline2: "Realmente Entrega",
    subtitlePre: "Zanix é um agente IA autónomo com",
    toolsLabel: "21 ferramentas profissionais",
    subtitlePost: ". Pesquisa na web, escreve e executa código, cria sites e realiza tarefas complexas — sem que você precise fazer nada.",
    navItems: ["Recursos", "Agentes", "Preços"],
    ctaStart: "Começar Grátis", ctaSignIn: "Entrar", ctaOpenChat: "Abrir Chat",
    scroll: "Rolar",
  },
} as const;
type LangCode = keyof typeof LANGS;

// ── Language Switcher Component ────────────────────────────────────
function LanguageSwitcher({ lang, setLang }: { lang: LangCode; setLang: (l: LangCode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS[lang];
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      {/* Mobile full-screen overlay backdrop */}
      <AnimatePresence>
        {open && isMobile && (
          <motion.div
            key="lang-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] sm:hidden"
          />
        )}
      </AnimatePresence>

      <div ref={ref} className="relative z-[201]">
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl glass border border-white/10 hover:border-primary/30 hover:bg-primary/8 text-white/55 hover:text-white transition-all text-xs font-semibold"
          aria-label="Language selector"
        >
          <Globe className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:block">{current.flag} {current.label}</span>
          <span className="sm:hidden text-sm leading-none">{current.flag}</span>
          <ChevronDown className={cn("w-3 h-3 transition-transform duration-200 shrink-0", open && "rotate-180")} />
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: isMobile ? 16 : -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isMobile ? 16 : -6, scale: 0.95 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "glass-elevated border border-white/12 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-[202]",
                isMobile
                  ? "fixed left-3 right-3 bottom-4 w-auto"
                  : "absolute right-0 top-full mt-2 w-52"
              )}
            >
              {/* Mobile header */}
              {isMobile && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <p className="text-xs font-bold text-white/50 uppercase tracking-widest">اختر اللغة</p>
                  <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className={cn("p-1.5 space-y-0.5", isMobile && "p-2 grid grid-cols-2 gap-1 space-y-0")}>
                {(Object.keys(LANGS) as LangCode[]).map(code => {
                  const l = LANGS[code];
                  const isActive = code === lang;
                  return (
                    <motion.button
                      key={code}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setLang(code); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150",
                        isActive
                          ? "bg-primary/15 text-primary border border-primary/20"
                          : "text-white/50 hover:text-white hover:bg-white/6 border border-transparent"
                      )}
                    >
                      <span className="text-base leading-none">{l.flag}</span>
                      <span className={cn("flex-1 text-left", l.dir === "rtl" ? "font-arabic" : "")}>{l.label}</span>
                      {isActive && <Check className="w-3 h-3 shrink-0 text-primary" />}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ── Static data ───────────────────────────────────────────────────
const TOOLS = [
  { name: "web_search", cat: "research" }, { name: "browse_web", cat: "research" },
  { name: "http_request", cat: "research" }, { name: "translate", cat: "research" },
  { name: "write_code", cat: "code" }, { name: "execute_code", cat: "code" },
  { name: "debug_code", cat: "code" }, { name: "build_website", cat: "build" },
  { name: "generate_diagram", cat: "build" }, { name: "write_document", cat: "build" },
  { name: "analyze_data", cat: "data" }, { name: "process_data", cat: "data" },
  { name: "calculate", cat: "data" }, { name: "get_realtime_data", cat: "fetch" },
  { name: "image_analyze", cat: "fetch" }, { name: "summarize_text", cat: "write" },
  { name: "structured_data", cat: "write" }, { name: "manage_files", cat: "system" },
  { name: "spawn_agents", cat: "agents" }, { name: "store_memory", cat: "agents" },
  { name: "search_memory", cat: "agents" },
];

const TOOL_COLORS: Record<string, string> = {
  research: "bg-blue-500/10 text-blue-300 border-blue-500/15",
  code: "bg-violet-500/10 text-violet-300 border-violet-500/15",
  build: "bg-pink-500/10 text-pink-300 border-pink-500/15",
  data: "bg-emerald-500/10 text-emerald-300 border-emerald-500/15",
  fetch: "bg-amber-500/10 text-amber-300 border-amber-500/15",
  write: "bg-cyan-500/10 text-cyan-300 border-cyan-500/15",
  system: "bg-violet-500/10 text-violet-300 border-violet-500/15",
  agents: "bg-primary/10 text-violet-300 border-primary/20",
};

const STATS = [
  { value: 21, label: "Professional Tools", suffix: "", color: "text-violet-400" },
  { value: 6, label: "Parallel Agents", suffix: "×", color: "text-cyan-400" },
  { value: 99.2, label: "Task Success Rate", suffix: "%", color: "text-emerald-400" },
  { value: 2.4, label: "Avg Response Time", suffix: "s", color: "text-amber-400" },
];

const FEATURES = [
  {
    icon: Globe, color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/15",
    title: "Deep Web Research",
    desc: "Full-page browsing, OCR extraction, multi-source search, and real-time HTTP requests to any API.",
    tools: ["web_search", "browse_web", "http_request"],
    badge: "Research",
  },
  {
    icon: Code2, color: "text-violet-400", bg: "bg-violet-500/8", border: "border-violet-500/15",
    title: "Code Engine",
    desc: "Writes, executes, and debugs JavaScript & Python in a secure sandboxed runtime environment.",
    tools: ["write_code", "execute_code", "debug_code"],
    badge: "Engineering",
  },
  {
    icon: Hammer, color: "text-pink-400", bg: "bg-pink-500/8", border: "border-pink-500/15",
    title: "Builder Suite",
    desc: "Generates full React websites, Mermaid diagrams, and richly-formatted document outputs.",
    tools: ["build_website", "generate_diagram", "write_document"],
    badge: "Creation",
  },
  {
    icon: BarChart3, color: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/15",
    title: "Data Intelligence",
    desc: "Processes CSVs and JSONs, evaluates complex math, and extracts visual insights with AI.",
    tools: ["analyze_data", "calculate", "process_data"],
    badge: "Analytics",
  },
  {
    icon: Zap, color: "text-amber-400", bg: "bg-amber-500/8", border: "border-amber-500/15",
    title: "Real-Time Feeds",
    desc: "Live weather, crypto prices, forex rates, images, and any public REST or GraphQL API.",
    tools: ["get_realtime_data", "image_analyze", "translate"],
    badge: "Live Data",
  },
  {
    icon: Network, color: "text-cyan-400", bg: "bg-cyan-500/8", border: "border-cyan-500/20",
    title: "Multi-Agent Swarm",
    desc: "Spawns 6 specialized sub-agents in parallel via Promise.all — your problems solved exponentially faster.",
    tools: ["spawn_agents", "store_memory", "search_memory"],
    badge: "Orchestration",
    highlight: true,
  },
];

const AGENT_TYPES = [
  { icon: Search, name: "Researcher", color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/15", desc: "Web & knowledge gathering" },
  { icon: Terminal, name: "Coder", color: "text-violet-400", bg: "bg-violet-500/8", border: "border-violet-500/15", desc: "Code, debug & execute" },
  { icon: Hammer, name: "Builder", color: "text-pink-400", bg: "bg-pink-500/8", border: "border-pink-500/15", desc: "Sites, docs & diagrams" },
  { icon: BarChart3, name: "Analyst", color: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/15", desc: "Data & statistics" },
  { icon: Zap, name: "Fetcher", color: "text-amber-400", bg: "bg-amber-500/8", border: "border-amber-500/15", desc: "Live APIs & real-time data" },
  { icon: FileText, name: "Writer", color: "text-cyan-400", bg: "bg-cyan-500/8", border: "border-cyan-500/15", desc: "Reports & summaries" },
];

// ── Counter animation ─────────────────────────────────────────────
function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState(0);
  const started = useRef(false);
  const isFloat = !Number.isInteger(value);

  useEffect(() => {
    if (isInView && !started.current) {
      started.current = true;
      let rafStart = 0;
      const duration = 1600;
      const step = (timestamp: number) => {
        if (!rafStart) rafStart = timestamp;
        const progress = Math.min((timestamp - rafStart) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayed(isFloat ? parseFloat((eased * value).toFixed(1)) : Math.floor(eased * value));
        if (progress < 1) requestAnimationFrame(step);
        else setDisplayed(value);
      };
      requestAnimationFrame(step);
    }
  }, [isInView, value, isFloat]);

  return <span ref={ref}>{isFloat ? displayed.toFixed(1) : displayed}</span>;
}

// ── FadeIn wrapper ────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = "", from = "bottom" }: {
  children: React.ReactNode; delay?: number; className?: string; from?: "bottom" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const variants = {
    hidden: { opacity: 0, y: from === "bottom" ? 28 : 0, x: from === "left" ? -28 : from === "right" ? 28 : 0 },
    visible: { opacity: 1, y: 0, x: 0 },
  };
  return (
    <motion.div ref={ref} variants={variants} initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >{children}</motion.div>
  );
}

// ── Feature card ──────────────────────────────────────────────────
function FeatureCard({ icon: Icon, color, bg, border, title, desc, tools, badge, highlight = false }: any) {
  return (
    <motion.div
      whileHover={{ y: -8, transition: { duration: 0.28 } }}
      className={cn(
        "relative glass-elevated rounded-3xl p-7 overflow-hidden group cursor-default border transition-all duration-300",
        highlight
          ? "border-primary/40 shadow-[0_0_50px_hsl(260_84%_63%/0.15)]"
          : "hover:shadow-[0_4px_24px_hsl(260_84%_63%/0.08)]"
      )}
    >
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-cyan-500/5 pointer-events-none" />
      )}
      {/* Hover glow */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none",
        highlight
          ? "bg-gradient-to-br from-primary/12 to-cyan-500/6"
          : `bg-gradient-to-br from-transparent to-white/3`
      )} />

      <div className="relative">
        {/* Badge */}
        <div className="flex items-center justify-between mb-5">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform duration-300 group-hover:scale-110", bg, border)}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
          <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider", bg, color, border)}>
            {badge}
          </span>
        </div>

        <h3 className="text-lg font-bold mb-2.5 group-hover:text-white transition-colors">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed mb-5 group-hover:text-white/65 transition-colors">{desc}</p>

        {/* Tool tags */}
        <div className="flex flex-wrap gap-1.5">
          {tools.map((t: string) => (
            <span key={t} className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/4 text-white/35 border border-white/6 hover:text-white/60 hover:bg-white/8 transition-all cursor-default">
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Pricing card (redesigned) ─────────────────────────────────────
interface PricingPlan {
  id: string;
  title: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  color: string;
  gradient: string;
  borderColor: string;
  glowColor: string;
  icon: React.ElementType;
  badge?: string;
  features: { text: string; included: boolean; highlight?: boolean }[];
  highlighted?: boolean;
  onClick: () => void;
  annual: boolean;
}

function PricingCard({ id, title, subtitle, monthlyPrice, annualPrice, color, gradient, borderColor, glowColor, icon: Icon, badge, features, highlighted = false, onClick, annual }: PricingPlan) {
  const price = annual ? annualPrice : monthlyPrice;
  const savings = monthlyPrice > 0 ? Math.round(((monthlyPrice - annualPrice) / monthlyPrice) * 100) : 0;

  return (
    <motion.div
      whileHover={{ y: highlighted ? -6 : -8, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } }}
      className={cn(
        "relative rounded-3xl border text-left transition-all duration-300 overflow-hidden flex flex-col",
        highlighted
          ? cn("shadow-[0_0_80px_hsl(260_84%_63%/0.22)]", borderColor)
          : cn("border-white/8 hover:border-white/14")
      )}
    >
      {/* Animated border glow for highlighted */}
      {highlighted && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: 9999 }}
          className={cn("absolute inset-0 rounded-3xl pointer-events-none", glowColor)}
        />
      )}

      {/* Background gradient */}
      <div className={cn("absolute inset-0 pointer-events-none", gradient)} />
      <div className="absolute inset-0 glass-elevated pointer-events-none" />

      {/* Popular badge */}
      {badge && (
        <div className="absolute -top-px inset-x-0 flex justify-center">
          <div className={cn("text-[11px] font-bold px-5 py-1.5 rounded-b-xl uppercase tracking-widest", color, "bg-gradient-to-r from-primary to-cyan-500 text-white shadow-[0_4px_16px_hsl(260_84%_63%/0.4)]")}>
            {badge}
          </div>
        </div>
      )}

      <div className="relative flex flex-col flex-1 p-7 pt-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className={cn("inline-flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest", color)}>
              <Icon className="w-3.5 h-3.5" />
              {title}
            </div>
            <p className="text-white/40 text-sm leading-snug max-w-[180px]">{subtitle}</p>
          </div>
          <div className={cn("w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-[0_2px_12px_hsl(260_84%_63%/0.12)]", borderColor, gradient)}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
        </div>

        {/* Price */}
        <div className="mb-7">
          <div className="flex items-end gap-1.5">
            <span className="text-sm text-white/35 mb-2">$</span>
            <span
              className={cn("text-5xl font-black leading-none tracking-tight", highlighted ? color : "text-white")}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {price}
            </span>
            <div className="mb-1.5">
              <span className="text-white/30 text-sm block leading-tight">/mo</span>
              {annual && savings > 0 && (
                <span className="text-emerald-400 text-[11px] font-bold">save {savings}%</span>
              )}
            </div>
          </div>
          {monthlyPrice === 0 && (
            <p className="text-white/25 text-xs mt-1">Free forever, no credit card</p>
          )}
        </div>

        {/* Divider */}
        <div className={cn("h-px mb-6 rounded-full", highlighted ? "bg-gradient-to-r from-transparent via-primary/40 to-transparent" : "bg-white/6")} />

        {/* Features */}
        <ul className="space-y-3 mb-8 flex-1">
          {features.map((f, i) => (
            <li key={i} className={cn("flex items-start gap-3 text-sm", f.included ? (f.highlight ? cn("font-semibold", color) : "text-white/70") : "text-white/22 line-through")}>
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                f.included
                  ? (highlighted ? cn("bg-primary/20 border", borderColor) : "bg-white/8 border border-white/10")
                  : "bg-white/4 border border-white/6"
              )}>
                <Check className={cn("w-3 h-3", f.included ? (highlighted ? color : "text-white/55") : "text-white/20")} />
              </div>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={onClick}
          className={cn(
            "w-full py-3.5 rounded-2xl font-bold text-sm transition-all relative overflow-hidden group flex items-center justify-center gap-2",
            highlighted
              ? "bg-primary hover:bg-primary/90 text-white shadow-[0_0_32px_hsl(260_84%_63%/0.35)]"
              : "border border-white/12 hover:border-white/22 hover:bg-white/6 text-white/65 hover:text-white"
          )}
        >
          {highlighted && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          )}
          <span className="relative">{monthlyPrice === 0 ? "Get Started Free" : "Start Plan"}</span>
          <ArrowRight className="relative w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Auth Modal ────────────────────────────────────────────────────
function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (tab === "login") {
        await loginMutation.mutateAsync({ data: { email, password } });
      } else {
        await registerMutation.mutateAsync({ data: { email, password, name } });
      }
      setLocation("/chat");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Authentication failed. Please try again.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={onClose}
          />
            <motion.div
            initial={{ opacity: 0, scale: 0.90, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.90, y: 32 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-[0_20px_60px_hsl(260_84%_63%/0.25)]"
          >
            {/* Gradient border */}
            <div className="absolute inset-0 rounded-3xl p-px bg-gradient-to-br from-primary/60 to-cyan-500/30 pointer-events-none" />
            <div className="relative glass-elevated rounded-3xl p-8">
              {/* Background glow */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,hsl(260_84%_63%/0.08),transparent)] pointer-events-none" />

              <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>

              <div className="text-center mb-7 relative">
                <div className="relative inline-flex mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-cyan-500/15 border border-primary/25 flex items-center justify-center shadow-[0_0_30px_hsl(260_84%_63%/0.25)]">
                    <ZanixLogo size={34} />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[hsl(228_22%_4%)] flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </span>
                </div>
                <h2 className="text-2xl font-display font-bold">Welcome to Zanix</h2>
                <p className="text-sm text-white/40 mt-1">Unlock autonomous multi-agent power</p>
              </div>

              {/* Tab toggle */}
              <div className="flex p-1 rounded-xl bg-white/4 border border-white/6 mb-6">
                {(["login", "register"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setError(""); }}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200",
                      tab === t
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-white/35 hover:text-white/65"
                    )}
                  >
                    {t === "login" ? "Sign In" : "Register"}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm text-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-3">
                <AnimatePresence>
                  {tab === "register" && (
                    <motion.div
                      key="name-field"
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="relative">
                        <User className="absolute left-4 top-3.5 w-4 h-4 text-white/25 pointer-events-none" />
                        <input
                          type="text" placeholder="Full Name" required value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full bg-white/4 border border-white/8 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 outline-none transition-all"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-white/25 pointer-events-none" />
                  <input
                    type="email" placeholder="Email Address" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white/4 border border-white/8 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 outline-none transition-all"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-white/25 pointer-events-none" />
                  <input
                    type="password" placeholder="Password (min. 8 chars)" required minLength={8} value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white/4 border border-white/8 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 outline-none transition-all"
                  />
                </div>

                <motion.button
                  type="submit" disabled={isPending}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full py-3.5 mt-1 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 glow-effect disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? <Spinner size="sm" /> : (
                    <>
                      {tab === "login" ? "Sign In" : "Create Account"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────
export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { data: userData } = useGetMe();
  const user = (userData as any)?.user ?? null;
  const [lang, setLang] = useState<LangCode>("en");
  const [annualBilling, setAnnualBilling] = useState(false);
  const t = LANGS[lang];
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroY = useTransform(scrollY, [0, 500], [0, -80]);
  const heroBgScale = useTransform(scrollY, [0, 600], [1, 1.12]);
  const isRTL = t.dir === "rtl";

  const handleStart = () => {
    if (user) {
      setLocation(user.onboardingCompleted ? "/chat" : "/onboarding");
    } else {
      setLocation("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden page-enter" dir={t.dir}>
      {/* ── Navigation ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 inset-x-0 z-50 glass-elevated border-b border-white/6 shadow-[0_1px_3px_hsl(260_84%_63%/0.04)]"
      >
        <div className="max-w-7xl mx-auto px-5 md:px-10 h-16 flex items-center justify-between">
          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary/25 to-cyan-500/15 border border-primary/25 flex items-center justify-center shadow-[0_0_16px_hsl(260_84%_63%/0.25)]">
              <ZanixLogo size={22} />
            </div>
            <span className={cn("font-bold text-xl tracking-tight", isRTL ? "font-arabic" : "font-display")}>Zanix</span>
            <span className="hidden sm:block ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20 uppercase tracking-widest">
              AI Agent
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-white/45 font-medium">
            {t.navItems.map((item, idx) => {
              const anchors = ["features", "agents", "pricing"];
              return (
                <a key={item} href={`#${anchors[idx]}`}
                  className="hover:text-white transition-colors duration-200 relative group"
                >
                  {item}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-primary group-hover:w-full transition-all duration-300" />
                </a>
              );
            })}
          </div>

          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <LanguageSwitcher lang={lang} setLang={setLang} />
            {user ? (
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }} 
                whileTap={{ scale: 0.96 }}
                onClick={() => setLocation("/chat")}
                className="text-sm font-semibold text-white/65 hover:text-white transition-colors relative group"
              >
                {t.ctaOpenChat}
                <span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-px bg-white transition-all duration-300" />
              </motion.button>
            ) : (
              <motion.button 
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setLocation("/auth")} 
                className="text-sm font-semibold text-white/50 hover:text-white transition-colors hidden sm:block relative group"
              >
                {t.ctaSignIn}
                <span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-px bg-white transition-all duration-300" />
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }} 
              whileTap={{ scale: 0.94 }}
              onClick={handleStart}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/85 text-white text-sm font-bold transition-all flex items-center gap-2 glow-lg shadow-lg relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
              <span className={cn("relative", isRTL ? "font-arabic" : "")}>{t.ctaStart}</span>
              <motion.div className="relative" animate={{ x: [0, 2, 0] }} transition={{ duration: 1.5, repeat: 9999 }}>
                <ArrowRight className={cn("w-3.5 h-3.5", isRTL && "rotate-180")} />
              </motion.div>
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 md:pt-52 md:pb-40 flex flex-col items-center text-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <motion.div style={{ scale: heroBgScale }} className="absolute inset-0">
            <img
              src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-20 mix-blend-screen"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/65 to-background" />
          {/* Dot grid */}
          <div className="absolute inset-0 dot-grid opacity-40" />
          {/* Central glow */}
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 6, repeat: 9999 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/10 rounded-full blur-[140px]" 
          />
          <motion.div 
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 7, repeat: 9999 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] bg-cyan-500/8 rounded-full blur-[100px]" 
          />
        </div>

        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="relative max-w-5xl mx-auto px-5">
          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass border-primary/25 text-sm font-semibold mb-8 cursor-default"
          >
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className={isRTL ? "font-arabic" : ""}>{t.badge}</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-[88px] leading-[1.04] mb-7 text-balance"
            style={{ fontFamily: "'Exo 2', sans-serif", fontWeight: 900, fontStyle: "italic", letterSpacing: "-0.03em" }}
          >
            {t.headline1}{" "}
            <br className="hidden sm:block" />
            <span className="text-gradient" style={{ fontFamily: "'Exo 2', sans-serif", fontStyle: "italic" }}>{t.headline2}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className={cn("text-lg md:text-xl text-white/45 max-w-2xl mx-auto mb-11 leading-relaxed font-light", isRTL && "font-arabic")}
          >
            {t.subtitlePre} <span className="text-white/70 font-medium">{t.toolsLabel}</span>{t.subtitlePost}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleStart}
              className="group relative w-full sm:w-auto overflow-hidden px-9 py-4 rounded-2xl bg-primary hover:bg-primary/95 text-white font-bold text-lg transition-all flex items-center justify-center gap-3 glow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/80 via-violet-500/80 to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className={cn("relative", isRTL && "font-arabic")}>{t.ctaStart}</span>
              <ArrowRight className={cn("relative w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-300", isRTL && "rotate-180")} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04, y: -2 }} 
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto px-9 py-4 rounded-2xl glass border border-white/12 hover:border-white/25 hover:bg-white/8 text-white font-bold text-lg transition-all flex items-center justify-center gap-3 group shadow-[0_2px_8px_hsl(260_84%_63%/0.04)]"
            >
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: 9999 }}>
                <Play className="w-4 h-4 fill-white group-hover:fill-primary transition-colors" />
              </motion.div>
              Watch Demo
            </motion.button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto"
          >
            {STATS.map((s, i) => (
              <motion.div 
              key={i}
              whileHover={{ scale: 1.05, y: -4 }}
              transition={{ duration: 0.2 }}
              className="glass-elevated rounded-2xl p-5 text-center hover:border-white/12 transition-all duration-300 group shadow-[0_2px_12px_hsl(260_84%_63%/0.06)] hover:shadow-[0_4px_20px_hsl(260_84%_63%/0.12)]"
            >
                <div className={cn("text-4xl mb-1 group-hover:scale-110 transition-transform duration-300", s.color)} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums" }}>
                  <AnimatedCounter value={s.value as number} suffix={s.suffix} />
                  <span>{s.suffix}</span>
                </div>
                <div className="text-[11px] text-white/40 font-medium leading-tight">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/25"
        >
          <span className={cn("text-[11px] uppercase tracking-widest font-medium", isRTL && "font-arabic")}>{t.scroll}</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: 9999 }}>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Tool Ticker ── */}
      <div className="py-6 border-y border-white/6 overflow-hidden relative bg-gradient-to-r from-primary/3 via-transparent to-primary/3">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background via-background/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background via-background/80 to-transparent z-10 pointer-events-none" />
        <div className="flex gap-3 ticker" style={{ width: "max-content" }}>
          {[...TOOLS, ...TOOLS].map((tool, i) => (
            <motion.span
              key={i}
              whileHover={{ scale: 1.08, y: -2 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono border shrink-0 cursor-default transition-all shadow-[0_1px_4px_hsl(260_84%_63%/0.04)] hover:shadow-[0_2px_8px_hsl(260_84%_63%/0.08)]",
                TOOL_COLORS[tool.cat] ?? "bg-white/5 text-white/40 border-white/8"
              )}
            >
              <motion.span 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: 9999 }}
                className="w-1.5 h-1.5 rounded-full bg-current shrink-0" 
              />
              {tool.name}
            </motion.span>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="py-32 px-5 md:px-10 max-w-7xl mx-auto relative">
        <FadeIn className="text-center mb-20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-elevated border-primary/25 text-sm font-semibold text-primary mb-6 shadow-[0_0_20px_hsl(260_84%_63%/0.1)]"
          >
            <Cpu className="w-3.5 h-3.5" />
            21 Professional Tools, 6 Specializations
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-5 text-balance leading-tight">
            Everything an Agent Needs.{" "}
            <br className="hidden sm:block" />
            <span className="text-gradient">Nothing It Doesn&apos;t.</span>
          </h2>
          <p className="text-white/45 text-lg max-w-xl mx-auto leading-relaxed font-light">
            Every tool is purpose-built for autonomous execution — from real-time data to full-stack website generation.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feat, i) => (
            <FadeIn key={i} delay={i * 0.07}>
              <FeatureCard {...feat} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Multi-Agent Architecture ── */}
      <section id="agents" className="py-32 px-5 border-y border-white/6 overflow-hidden relative bg-gradient-to-b from-primary/3 via-transparent to-primary/2">
        <div className="absolute inset-0 line-grid opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative">

          <FadeIn from="left" className="flex-1 space-y-8 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/8 text-cyan-400 text-sm font-semibold">
              <Activity className="w-3.5 h-3.5" />
              Breakthrough Architecture
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-balance">
              Parallel Execution.<br />
              <span className="text-gradient">Exponential Results.</span>
            </h2>
            <p className="text-lg text-white/45 leading-relaxed">
              Zanix decomposes your goal into parallel sub-tasks and assigns them to specialized agents all running simultaneously via{" "}
              <code className="text-violet-300 font-mono bg-violet-500/10 px-2 py-0.5 rounded-md text-sm border border-violet-500/15">
                Promise.all
              </code>
              . Results are synthesized into one coherent answer.
            </p>
            <ul className="space-y-5">
              {[
                { icon: Brain, color: "text-primary", bg: "bg-primary/10 border-primary/20", label: "Smart Goal Decomposition", desc: "GPT-powered planning breaks complex goals into atomic, parallelizable sub-tasks" },
                { icon: Database, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", label: "Shared Memory Bus", desc: "Agents share context in real-time through a persistent memory system" },
                { icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Fault-Tolerant Synthesis", desc: "Failed sub-agents are gracefully handled — overall results stay coherent" },
              ].map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                  className="flex items-start gap-4"
                >
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border", item.bg)}>
                    <item.icon className={cn("w-4 h-4", item.color)} />
                  </div>
                  <div>
                    <div className="font-semibold text-white/90 mb-0.5">{item.label}</div>
                    <div className="text-sm text-white/40 leading-relaxed">{item.desc}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          </FadeIn>

          <FadeIn from="right" delay={0.15} className="flex-1 w-full">
            <div className="relative">
              {/* Outer glow */}
              <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl" />
              <div className="relative glass-elevated rounded-3xl p-7 border border-primary/20 shadow-[0_8px_32px_hsl(260_84%_63%/0.12)]">
                {/* Orchestrator header */}
                <div className="text-center mb-6">
                  <motion.div
                    animate={{ 
                      boxShadow: [
                        "0 0 0px hsl(260 84% 63% / 0)",
                        "0 0 40px hsl(260 84% 63% / 0.35)",
                        "0 0 0px hsl(260 84% 63% / 0)"
                      ],
                      scale: [1, 1.02, 1]
                    }}
                    transition={{ duration: 3, repeat: 9999 }}
                    className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-primary/15 border border-primary/30 text-sm font-bold"
                  >
                    <Brain className="w-4 h-4 text-primary/90" />
                    <span className="text-primary/90">Orchestrator</span>
                  </motion.div>
                  <p className="text-xs text-white/35 mt-2 font-medium">Decomposes goals → Synthesizes results</p>
                </div>

                {/* Connection lines visual */}
                <div className="relative mb-4">
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-px h-4 bg-gradient-to-b from-primary/40 to-transparent" />
                </div>

                {/* Agent grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {AGENT_TYPES.map((agent, i) => (
                      <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.80, y: 16 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      whileHover={{ scale: 1.08, y: -2, transition: { duration: 0.2 } }}
                      transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border text-center cursor-default shadow-[0_2px_8px_hsl(260_84%_63%/0.06)] hover:shadow-[0_4px_16px_hsl(260_84%_63%/0.1)] transition-shadow duration-300",
                        agent.bg, agent.border
                      )}
                    >
                      <div className={cn("w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center", agent.color)}>
                        <agent.icon className="w-4 h-4" />
                      </div>
                      <div className={cn("font-bold text-xs", agent.color)}>{agent.name}</div>
                      <div className="text-[10px] text-white/30 leading-tight">{agent.desc}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 text-center">
                  <span className="text-xs text-white/25">All agents run </span>
                  <span className="text-xs font-bold text-cyan-400">simultaneously</span>
                  <span className="text-xs text-white/25"> via Promise.all</span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 md:py-36 px-4 sm:px-6 max-w-6xl mx-auto relative">
        {/* Section header */}
        <FadeIn className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-elevated border-primary/25 text-sm font-semibold text-primary mb-6 shadow-[0_0_20px_hsl(260_84%_63%/0.1)]">
            <Layers className="w-3.5 h-3.5" />
            Choose your plan
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-4 text-balance leading-tight">
            Simple, transparent{" "}
            <span className="text-gradient">pricing</span>
          </h2>
          <p className="text-white/45 text-base sm:text-lg font-light max-w-lg mx-auto">
            No surprises. No hidden fees. Upgrade or downgrade anytime.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 rounded-2xl glass-elevated border border-white/8 shadow-[0_2px_12px_hsl(260_84%_63%/0.06)]">
            <button
              onClick={() => setAnnualBilling(false)}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                !annualBilling
                  ? "bg-white/10 text-white shadow-[0_2px_8px_hsl(260_84%_63%/0.12)] border border-white/12"
                  : "text-white/40 hover:text-white/65"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnualBilling(true)}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                annualBilling
                  ? "bg-primary/20 text-primary border border-primary/25 shadow-[0_2px_8px_hsl(260_84%_63%/0.12)]"
                  : "text-white/40 hover:text-white/65"
              )}
            >
              Annual
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-bold">
                −25%
              </span>
            </button>
          </div>
        </FadeIn>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-stretch">
          {[
            {
              id: "free",
              title: "Starter",
              subtitle: "For personal projects & exploration",
              monthlyPrice: 0,
              annualPrice: 0,
              icon: Zap,
              color: "text-white/70",
              gradient: "bg-gradient-to-b from-white/4 to-transparent",
              borderColor: "border-white/10",
              glowColor: "",
              features: [
                { text: "10 tasks / month", included: true },
                { text: "2 parallel agents", included: true },
                { text: "Core 10 tools", included: true },
                { text: "Community support", included: true },
                { text: "Persistent memory", included: false },
                { text: "File manager", included: false },
                { text: "Priority queue", included: false },
              ],
            },
            {
              id: "pro",
              title: "Pro",
              subtitle: "For power users who need maximum output",
              monthlyPrice: 29,
              annualPrice: 22,
              icon: Cpu,
              badge: "Most Popular",
              color: "text-violet-400",
              gradient: "bg-gradient-to-b from-primary/12 to-cyan-500/4",
              borderColor: "border-primary/40",
              glowColor: "bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(260_84%_63%/0.18),transparent)]",
              highlighted: true,
              features: [
                { text: "Unlimited tasks", included: true, highlight: true },
                { text: "6 parallel agents", included: true, highlight: true },
                { text: "All 21 tools", included: true, highlight: true },
                { text: "Priority execution", included: true },
                { text: "Persistent memory", included: true },
                { text: "File manager access", included: true },
                { text: "API access", included: false },
              ],
            },
            {
              id: "enterprise",
              title: "Enterprise",
              subtitle: "For teams & organizations at scale",
              monthlyPrice: 99,
              annualPrice: 74,
              icon: Shield,
              color: "text-amber-400",
              gradient: "bg-gradient-to-b from-amber-500/6 to-transparent",
              borderColor: "border-amber-500/20",
              glowColor: "",
              features: [
                { text: "Everything in Pro", included: true, highlight: true },
                { text: "Full REST API access", included: true },
                { text: "Custom agent configs", included: true },
                { text: "Dedicated infra", included: true },
                { text: "SAML SSO", included: true },
                { text: "24/7 SLA support", included: true },
                { text: "Custom integrations", included: true },
              ],
            },
          ].map((plan, i) => (
            <FadeIn key={plan.id} delay={i * 0.08} className="flex flex-col">
              <PricingCard
                {...plan}
                annual={annualBilling}
                onClick={handleStart}
              />
            </FadeIn>
          ))}
        </div>

        {/* Bottom note */}
        <FadeIn className="text-center mt-10 text-sm text-white/25">
          All plans include SSL, 99.9% uptime SLA, and GDPR compliance.{" "}
          <button onClick={handleStart} className="text-primary/60 hover:text-primary transition-colors underline underline-offset-2">
            Compare all features →
          </button>
        </FadeIn>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-16 md:py-24 px-4 sm:px-6">
        <FadeIn>
          <div className="relative max-w-4xl mx-auto glass-card rounded-3xl overflow-hidden p-8 sm:p-10 md:p-14 text-center border border-primary/15">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,hsl(260_84%_63%/0.1),transparent)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,hsl(186_100%_50%/0.05),transparent)] pointer-events-none" />
            <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

            <div className="relative">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shadow-[0_0_30px_hsl(260_84%_63%/0.2)]">
                  <ZanixLogo size={32} />
                </div>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-black mb-4">
                Ready to work smarter?
              </h2>
              <p className="text-white/45 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
                Join thousands of engineers, researchers, and builders who use Zanix to get 10× more done every single day.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={handleStart}
                  className="px-10 py-4 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-lg transition-all flex items-center gap-3 shadow-[0_0_40px_hsl(260_84%_63%/0.3)] glow-effect"
                >
                  Get Started Free <ArrowRight className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="px-10 py-4 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/4 text-white font-bold text-lg transition-all flex items-center gap-3"
                >
                  <MousePointer2 className="w-4 h-4" />
                  View Docs
                </motion.button>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <ZanixLogo size={22} />
            <span className="font-display font-bold text-white/80">Zanix</span>
            <span className="text-white/20 text-sm">— Autonomous AI Agent</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/25">
            <a href="#" className="hover:text-white/55 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/55 transition-colors">Terms</a>
            <a href="#" className="hover:text-white/55 transition-colors">Docs</a>
            <span>© {new Date().getFullYear()} Zanix AI</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
