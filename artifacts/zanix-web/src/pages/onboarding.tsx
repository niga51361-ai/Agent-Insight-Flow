import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Sparkles, AlertCircle,
  Bot, Brain, Smile, Briefcase, Rocket, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ZanixLogo from "@/components/zanix-logo";

// ── Constants ──────────────────────────────────────────────────────
const INTERESTS = [
  { id: "التكنولوجيا", emoji: "💻", color: "from-cyan-500/20 to-blue-500/20",    border: "border-cyan-500/30",    active: "bg-cyan-500/15 border-cyan-500/50 text-cyan-300" },
  { id: "الأعمال",     emoji: "📊", color: "from-amber-500/20 to-orange-500/20",  border: "border-amber-500/30",   active: "bg-amber-500/15 border-amber-500/50 text-amber-300" },
  { id: "العلوم",      emoji: "🔬", color: "from-violet-500/20 to-indigo-500/20", border: "border-violet-500/30",  active: "bg-violet-500/15 border-violet-500/50 text-violet-300" },
  { id: "الفنون",      emoji: "🎨", color: "from-pink-500/20 to-rose-500/20",     border: "border-pink-500/30",    active: "bg-pink-500/15 border-pink-500/50 text-pink-300" },
  { id: "الرياضة",     emoji: "⚽", color: "from-emerald-500/20 to-teal-500/20",  border: "border-emerald-500/30", active: "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" },
  { id: "السفر",       emoji: "✈️", color: "from-sky-500/20 to-cyan-500/20",      border: "border-sky-500/30",     active: "bg-sky-500/15 border-sky-500/50 text-sky-300" },
  { id: "الطعام",      emoji: "🍜", color: "from-orange-500/20 to-red-500/20",    border: "border-orange-500/30",  active: "bg-orange-500/15 border-orange-500/50 text-orange-300" },
  { id: "الموسيقى",    emoji: "🎵", color: "from-purple-500/20 to-violet-500/20", border: "border-purple-500/30",  active: "bg-purple-500/15 border-purple-500/50 text-purple-300" },
  { id: "التعلّم",     emoji: "📚", color: "from-lime-500/20 to-green-500/20",    border: "border-lime-500/30",    active: "bg-lime-500/15 border-lime-500/50 text-lime-300" },
  { id: "المال",       emoji: "💰", color: "from-yellow-500/20 to-amber-500/20",  border: "border-yellow-500/30",  active: "bg-yellow-500/15 border-yellow-500/50 text-yellow-300" },
  { id: "الصحة",       emoji: "🧘", color: "from-teal-500/20 to-emerald-500/20",  border: "border-teal-500/30",    active: "bg-teal-500/15 border-teal-500/50 text-teal-300" },
  { id: "التصميم",     emoji: "✏️", color: "from-rose-500/20 to-pink-500/20",     border: "border-rose-500/30",    active: "bg-rose-500/15 border-rose-500/50 text-rose-300" },
];

const PERSONALITIES = [
  {
    id: "analytical",
    icon: Brain,
    name: "تحليلي",
    desc: "يعتمد البيانات والمنطق. مثالي للبحث وحل المشكلات.",
    emoji: "🔬",
    accent: "from-cyan-500/20 to-blue-500/20",
    border: "border-cyan-500/30",
    active: "border-cyan-500/60 shadow-[0_0_24px_hsl(186_100%_50%/0.15)]",
    check: "text-cyan-400",
  },
  {
    id: "creative",
    icon: Sparkles,
    name: "إبداعي",
    desc: "خيالي ومبتكر. مثالي للعصف الذهني والتصميم.",
    emoji: "🎨",
    accent: "from-violet-500/20 to-pink-500/20",
    border: "border-violet-500/30",
    active: "border-violet-500/60 shadow-[0_0_24px_hsl(260_84%_63%/0.15)]",
    check: "text-violet-400",
  },
  {
    id: "friendly",
    icon: Smile,
    name: "ودود",
    desc: "دافئ وقريب. رائع للمهام اليومية والدعم.",
    emoji: "😊",
    accent: "from-emerald-500/20 to-teal-500/20",
    border: "border-emerald-500/30",
    active: "border-emerald-500/60 shadow-[0_0_24px_hsl(160_84%_39%/0.15)]",
    check: "text-emerald-400",
  },
  {
    id: "professional",
    icon: Briefcase,
    name: "احترافي",
    desc: "رسمي وفعّال. الأفضل لسير عمل الأعمال والمديرين.",
    emoji: "💼",
    accent: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/30",
    active: "border-amber-500/60 shadow-[0_0_24px_hsl(38_92%_50%/0.15)]",
    check: "text-amber-400",
  },
];

// ── Step indicator ─────────────────────────────────────────────────
function StepDot({ n, current }: { n: number; current: number }) {
  const isActive = n === current;
  const isPast   = n < current;
  return (
    <div className={cn(
      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300",
      isActive && "bg-primary border-primary text-white shadow-[0_0_16px_hsl(260_84%_63%/0.5)]",
      isPast   && "bg-primary/20 border-primary/40 text-primary",
      !isActive && !isPast && "bg-white/5 border-white/12 text-white/30",
    )}>
      {isPast ? <Check className="w-3.5 h-3.5" /> : n}
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return (
    <div className="flex-1 h-px mx-2 relative overflow-hidden bg-white/8 rounded-full">
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-cyan-500 rounded-full"
        initial={{ width: "0%" }}
        animate={{ width: done ? "100%" : "0%" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

// ── Interest chip ──────────────────────────────────────────────────
function InterestChip({ item, selected, onToggle }: {
  item: typeof INTERESTS[0]; selected: boolean; onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all duration-200 overflow-hidden",
        selected
          ? cn("text-white border-2", item.active)
          : "bg-white/4 border-white/10 text-white/50 hover:bg-white/8 hover:border-white/18 hover:text-white/75"
      )}
    >
      {selected && (
        <motion.div
          className={cn("absolute inset-0 bg-gradient-to-br opacity-80", item.color)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      <span className="relative text-base leading-none">{item.emoji}</span>
      <span className="relative">{item.id}</span>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="relative w-4 h-4 rounded-full bg-white/20 flex items-center justify-center"
        >
          <Check className="w-2.5 h-2.5 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
}

// ── Main ───────────────────────────────────────────────────────────
interface OnboardingData {
  agentName: string;
  userBackground: string;
  userInterests: string[];
  agentPersonality: string;
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError]     = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [userName, setUserName]       = useState("");
  const [nameError, setNameError]     = useState("");
  const [data, setData] = useState<OnboardingData>({
    agentName: "",
    userBackground: "",
    userInterests: [],
    agentPersonality: "friendly",
  });

  useEffect(() => {
    fetch("/api/auth/me", { signal: AbortSignal.timeout(8000) })
      .then(async r => {
        if (!r.ok) { setAuthError(true); setTimeout(() => setLocation("/auth"), 2500); return; }
        const { user } = await r.json();
        setUserName(user.name?.split(" ")[0] || "");
        if (user.onboardingCompleted) { setLocation("/chat"); return; }
      })
      .catch(() => { setAuthError(true); setTimeout(() => setLocation("/auth"), 2500); })
      .finally(() => setInitializing(false));
  }, [setLocation]);

  const toggleInterest = (id: string) =>
    setData(p => ({
      ...p,
      userInterests: p.userInterests.includes(id)
        ? p.userInterests.filter(i => i !== id)
        : [...p.userInterests, id],
    }));

  const handleNext = () => {
    if (step === 1) {
      if (!data.agentName.trim()) { setNameError("يرجى إعطاء اسم للوكيل"); return; }
      if (data.agentName.length < 2) { setNameError("يجب أن يكون الاسم حرفَين على الأقل"); return; }
      setNameError("");
    }
    setStep(s => Math.min(s + 1, 3));
  };

  const handleFinish = async () => {
    setLoading(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/auth/profile/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: data.agentName.trim(),
          agentPersonality: data.agentPersonality,
          userInterests: data.userInterests,
          userBackground: data.userBackground.trim(),
          chatBackground: "default",
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "فشل الحفظ");
      }
      setLocation("/chat");
    } catch (err: any) {
      setSubmitError(err.message || "حدث خطأ ما. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // ── Auth error ──────────────────────────────────────────────────
  if (authError) return (
    <div className="min-h-screen bg-transparent flex items-center justify-center px-5" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-5 max-w-sm"
      >
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">يلزم تسجيل الدخول</h1>
        <p className="text-white/45 text-sm">يرجى تسجيل الدخول للمتابعة.</p>
        <div className="flex items-center justify-center gap-2 text-white/25 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-white/25 animate-pulse" />
          جارٍ التوجيه…
        </div>
      </motion.div>
    </div>
  );

  // ── Skeleton ────────────────────────────────────────────────────
  if (initializing) return (
    <div className="min-h-screen bg-transparent flex flex-col" dir="rtl">
      <div className="h-0.5 bg-primary/20" />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-lg px-6 space-y-8 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-white/6 mx-auto" />
          <div className="space-y-3 text-center">
            <div className="h-8 bg-white/6 rounded-xl w-2/3 mx-auto" />
            <div className="h-5 bg-white/4 rounded-xl w-1/2 mx-auto" />
          </div>
          <div className="h-14 bg-white/4 rounded-2xl" />
          <div className="h-12 bg-primary/15 rounded-2xl" />
        </div>
      </div>
    </div>
  );

  const agentDisplayName = data.agentName || "وكيلك";

  return (
    <div className="min-h-screen bg-transparent flex flex-col" dir="rtl">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,hsl(260_84%_63%/0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_20%_90%,hsl(186_100%_50%/0.05),transparent)]" />
        <div className="absolute inset-0 dot-grid opacity-[0.07]" />
      </div>

      {/* Top progress bar */}
      <div className="relative h-0.5 bg-white/5 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-violet-400 to-cyan-400"
          animate={{ width: `${(step / 3) * 100}%` }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/5">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
            <ZanixLogo size={18} />
          </div>
          <span className="text-sm font-bold text-white/70">Zanix AI</span>
        </div>

        {/* Step dots */}
        <div className="flex items-center">
          {[1, 2, 3].map((n, i) => (
            <React.Fragment key={n}>
              <StepDot n={n} current={step} />
              {i < 2 && <StepLine done={step > n} />}
            </React.Fragment>
          ))}
        </div>

        <div className="text-xs text-white/25 font-medium">
          الخطوة {step} من 3
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 flex items-start md:items-center justify-center px-4 sm:px-6 py-10 md:py-16 overflow-y-auto">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Name agent ──────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-8"
              >
                <div className="text-center space-y-5">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3.5, repeat: 9999, ease: "easeInOut" }}
                    className="relative inline-flex"
                  >
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/25 to-cyan-500/15 border border-primary/25 flex items-center justify-center shadow-[0_0_60px_hsl(260_84%_63%/0.25)]">
                      <Bot className="w-12 h-12 text-primary" />
                    </div>
                    <span className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[hsl(228_22%_4%)] flex items-center justify-center shadow-[0_0_12px_hsl(160_84%_39%/0.5)]">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </span>
                  </motion.div>

                  <div>
                    <h1 className="text-3xl sm:text-4xl font-display font-black text-white mb-2 leading-tight">
                      {userName ? `أهلاً، ${userName}! 👋` : "أهلاً بك! 👋"}
                    </h1>
                    <p className="text-white/40 text-base">
                      لنُعِدّ وكيلك الشخصي في خطوات بسيطة.
                    </p>
                  </div>
                </div>

                <div className="glass-elevated rounded-3xl p-7 border border-white/7 space-y-5">
                  {/* Agent name */}
                  <div>
                    <label className="text-sm font-semibold text-white/80 mb-3 block">
                      ما الاسم الذي ستُعطيه لوكيلك الذكي؟
                    </label>
                    <div className={cn(
                      "relative flex items-center rounded-2xl border transition-all duration-200",
                      nameError
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-white/10 bg-white/5 focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_hsl(260_84%_63%/0.12)]"
                    )}>
                      <Bot className="absolute right-4 w-5 h-5 text-white/20 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="مثال: نكسس، نوفا، أريس…"
                        value={data.agentName}
                        onChange={e => { setData(p => ({ ...p, agentName: e.target.value })); setNameError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleNext()}
                        maxLength={50}
                        autoFocus
                        className="w-full bg-transparent py-4 pr-12 pl-16 text-base text-white placeholder:text-white/20 focus:outline-none"
                      />
                      <span className="absolute left-4 text-xs text-white/20">{data.agentName.length}/50</span>
                    </div>
                    {nameError && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-red-400 mt-2 pr-1"
                      >
                        {nameError}
                      </motion.p>
                    )}
                    <p className="text-xs text-white/25 mt-2 pr-1">يمكنك تغيير هذا لاحقاً من الإعدادات.</p>
                  </div>

                  {/* Background */}
                  <div>
                    <label className="text-sm font-semibold text-white/80 mb-3 block">
                      نبذة مختصرة عنك <span className="text-white/30 font-normal">(اختياري)</span>
                    </label>
                    <textarea
                      placeholder="أنا مهندس برمجيات متخصص في منتجات الذكاء الاصطناعي. أحب حل المشكلات وبناء الأنظمة على نطاق واسع…"
                      value={data.userBackground}
                      onChange={e => setData(p => ({ ...p, userBackground: e.target.value }))}
                      maxLength={500}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white placeholder:text-white/20 focus:border-primary/50 focus:outline-none focus:shadow-[0_0_0_3px_hsl(260_84%_63%/0.1)] transition-all resize-none"
                    />
                    <p className="text-xs text-white/20 mt-1.5 pl-1 text-left">{data.userBackground.length}/500</p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleNext}
                    disabled={!data.agentName.trim()}
                    className="w-full py-4 rounded-2xl bg-primary hover:bg-primary/92 disabled:bg-white/6 disabled:cursor-not-allowed text-white font-bold transition-all flex items-center justify-center gap-2 shadow-[0_4px_24px_hsl(260_84%_63%/0.35)] disabled:shadow-none"
                  >
                    المتابعة <ArrowLeft className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Interests ────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-7"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl sm:text-4xl font-display font-black text-white leading-tight">
                    ما الذي يهمّك؟
                  </h2>
                  <p className="text-white/40 text-base">
                    سيستخدم {agentDisplayName} هذه المعلومات لتخصيص تجربتك.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 justify-center">
                  {INTERESTS.map(item => (
                    <InterestChip
                      key={item.id}
                      item={item}
                      selected={data.userInterests.includes(item.id)}
                      onToggle={() => toggleInterest(item.id)}
                    />
                  ))}
                </div>

                {data.userInterests.length > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-xs text-white/30"
                  >
                    {data.userInterests.length} مختارة · {data.userInterests.join("، ")}
                  </motion.p>
                )}

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => setStep(1)}
                    className="flex-none px-6 py-4 rounded-2xl border border-white/10 hover:border-white/20 text-white/60 hover:text-white font-semibold transition-all flex items-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                    onClick={handleNext}
                    className="flex-1 py-4 rounded-2xl bg-primary hover:bg-primary/92 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-[0_4px_24px_hsl(260_84%_63%/0.35)]"
                  >
                    {data.userInterests.length === 0 ? "تخطّي الآن" : "المتابعة"}
                    <ArrowLeft className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Personality + Launch ─────────────────── */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-7"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl sm:text-4xl font-display font-black text-white leading-tight">
                    اختر أسلوب {agentDisplayName}
                  </h2>
                  <p className="text-white/40 text-base">
                    كيف تريد أن يتواصل معك وكيلك؟
                  </p>
                </div>

                {/* Personality cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {PERSONALITIES.map(p => {
                    const isSelected = data.agentPersonality === p.id;
                    return (
                      <motion.button
                        key={p.id}
                        whileHover={{ scale: 1.02, y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setData(prev => ({ ...prev, agentPersonality: p.id }))}
                        className={cn(
                          "relative p-5 rounded-2xl border-2 text-right transition-all duration-250 overflow-hidden group",
                          isSelected
                            ? cn("bg-gradient-to-br", p.accent, p.active)
                            : cn("bg-white/3 border-white/8 hover:border-white/18 hover:bg-white/6", p.border)
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="personality-glow"
                            className={cn("absolute inset-0 bg-gradient-to-br opacity-50", p.accent)}
                          />
                        )}

                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-3xl leading-none">{p.emoji}</span>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0, rotate: 90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                className={cn("w-6 h-6 rounded-full bg-white/15 border border-white/25 flex items-center justify-center", p.check)}
                              >
                                <Check className="w-4 h-4" />
                              </motion.div>
                            )}
                          </div>
                          <h3 className="font-bold text-white mb-1.5">{p.name}</h3>
                          <p className="text-xs text-white/45 leading-relaxed">{p.desc}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Error */}
                <AnimatePresence>
                  {submitError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center"
                    >
                      {submitError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => setStep(2)}
                    disabled={loading}
                    className="flex-none px-6 py-4 rounded-2xl border border-white/10 hover:border-white/20 text-white/60 hover:text-white font-semibold transition-all flex items-center gap-2 disabled:opacity-40"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.01, y: loading ? 0 : -1 }}
                    whileTap={{ scale: loading ? 1 : 0.99 }}
                    onClick={handleFinish}
                    disabled={loading}
                    className="flex-1 relative py-4 rounded-2xl bg-primary hover:bg-primary/92 disabled:opacity-70 text-white font-bold transition-all flex items-center justify-center gap-2.5 overflow-hidden shadow-[0_4px_32px_hsl(260_84%_63%/0.4)]"
                  >
                    {/* Shimmer */}
                    {!loading && (
                      <motion.span
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 2.5, repeat: 9999, ease: "easeInOut", repeatDelay: 1.5 }}
                      />
                    )}

                    {loading ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>جارٍ إطلاق {agentDisplayName}…</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        <span>إطلاق {agentDisplayName}</span>
                      </>
                    )}
                  </motion.button>
                </div>

                <p className="text-center text-xs text-white/20 leading-relaxed">
                  يمكنك تغيير جميع الإعدادات لاحقاً من لوحة التحكم.
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
