import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight,
  Zap, Shield, Cpu, Globe, ChevronLeft, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ZanixLogo from "@/components/zanix-logo";
import { useLogin, useRegister, useGetMe } from "@workspace/api-client-react";

// ── Password strength ──────────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "ضعيفة", color: "bg-red-500" };
  if (score <= 2) return { score, label: "مقبولة", color: "bg-amber-500" };
  if (score <= 3) return { score, label: "جيدة", color: "bg-cyan-500" };
  return { score, label: "قوية", color: "bg-emerald-500" };
}

// ── Feature list ──────────────────────────────────────────────────
const FEATURES = [
  { icon: Zap,    label: "21 أداة احترافية",          sub: "ويب، كود، ملفات، APIs والمزيد" },
  { icon: Cpu,    label: "تنسيق متعدد الوكلاء",       sub: "6 وكلاء متوازيون يعملون لك" },
  { icon: Globe,  label: "ذاكرة دائمة",               sub: "يتذكر السياق عبر الجلسات" },
  { icon: Shield, label: "أمان على مستوى المؤسسات",  sub: "تشفير كامل، معايير SOC 2" },
];

// ── Testimonials ──────────────────────────────────────────────────
const TESTIMONIALS = [
  { name: "سارة م.", role: "مهندسة رئيسية · Acme Corp", avatar: "س", text: '"زانيكس قلّص وقت أبحاثنا بنسبة 80٪. كأنك تمتلك موظفاً عبقرياً لا ينام أبداً."' },
  { name: "أحمد ك.", role: "مدير منتج · TechVentures", avatar: "أ", text: '"أنجزت في يوم ما كان يستغرق أسبوعاً. الوكيل يفهم ما تريده فعلاً."' },
];

// ── Input field ───────────────────────────────────────────────────
function Field({
  icon: Icon, type, placeholder, value, onChange, rightSlot, error,
}: {
  icon: React.ElementType;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rightSlot?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className={cn(
        "relative flex items-center rounded-xl border transition-all duration-200 overflow-hidden group",
        error
          ? "border-red-500/50 bg-red-500/5"
          : "border-white/8 bg-white/4 focus-within:border-primary/50 focus-within:bg-white/6 focus-within:shadow-[0_0_0_3px_hsl(260_84%_63%/0.1)]"
      )}>
        <Icon className="absolute left-4 w-4 h-4 text-white/25 group-focus-within:text-primary/60 transition-colors pointer-events-none" />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          dir="ltr"
          className="w-full bg-transparent py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-white/25 focus:outline-none"
        />
        {rightSlot && <div className="absolute right-3">{rightSlot}</div>}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400 pr-1 text-right"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ── Floating dot ──────────────────────────────────────────────────
function FloatDot({ x, y, delay, size = 1 }: { x: number; y: number; delay: number; size?: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-primary/30"
      style={{ left: `${x}%`, top: `${y}%`, width: size * 4, height: size * 4 }}
      animate={{ y: [-8, 8, -8], opacity: [0.15, 0.6, 0.15] }}
      transition={{ duration: 3.5 + delay, repeat: 9999, delay, ease: "easeInOut" }}
    />
  );
}

// ── Main Auth Page ────────────────────────────────────────────────
export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { data: userData } = useGetMe();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPw, setShowPw] = useState(false);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const loginMutation    = useLogin();
  const registerMutation = useRegister();
  const isPending = loginMutation.isPending || registerMutation.isPending;
  const strength  = getStrength(password);

  // Rotate testimonials
  useEffect(() => {
    const t = setInterval(() => setTestimonialIdx(i => (i + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(t);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    const user = (userData as any)?.user;
    if (user) setLocation(user.onboardingCompleted ? "/chat" : "/onboarding");
  }, [userData, setLocation]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (tab === "register" && !name.trim()) e.name = "الاسم مطلوب";
    if (!email.trim()) e.email = "البريد الإلكتروني مطلوب";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "بريد إلكتروني غير صحيح";
    if (!password) e.password = "كلمة المرور مطلوبة";
    else if (password.length < 8) e.password = "يجب أن تكون 8 أحرف على الأقل";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    try {
      if (tab === "login") {
        const res = await loginMutation.mutateAsync({ data: { email, password } });
        const user = (res as any)?.user;
        setLocation(user?.onboardingCompleted ? "/chat" : "/onboarding");
      } else {
        await registerMutation.mutateAsync({ data: { email, password, name } });
        setLocation("/onboarding");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "";
      if (msg.includes("already registered") || msg.includes("Email already")) {
        setServerError("هذا البريد الإلكتروني مسجّل بالفعل. هل تريد تسجيل الدخول؟");
      } else if (msg.includes("Invalid email or password")) {
        setServerError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else {
        setServerError("حدث خطأ ما. يرجى المحاولة مرة أخرى.");
      }
    }
  };

  const switchTab = (t: "login" | "register") => {
    setTab(t); setErrors({}); setServerError(""); setPassword("");
  };

  const dots = [
    { x: 12, y: 18, delay: 0,   size: 1 },
    { x: 78, y: 12, delay: 0.8, size: 1.5 },
    { x: 48, y: 58, delay: 1.4, size: 1 },
    { x: 88, y: 72, delay: 2,   size: 2 },
    { x: 22, y: 82, delay: 0.5, size: 1 },
    { x: 62, y: 32, delay: 1.8, size: 1.5 },
    { x: 35, y: 45, delay: 2.5, size: 1 },
  ];

  return (
    <div className="min-h-screen flex bg-transparent overflow-hidden" dir="rtl">

      {/* ── Left panel (shown on right in RTL): Branding ─────── */}
      <div className="hidden lg:flex lg:w-[50%] flex-col relative overflow-hidden order-2">
        {/* Backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(260_84%_7%)] via-[hsl(228_22%_5%)] to-[hsl(186_100%_4%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_40%_20%,hsl(260_84%_63%/0.2),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_65%_85%,hsl(186_100%_50%/0.08),transparent)]" />
        <div className="absolute inset-0 dot-grid opacity-[0.15]" />

        {dots.map((d, i) => <FloatDot key={i} {...d} />)}

        {/* Glowing orb */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 7, repeat: 9999, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none"
        />

        <div className="relative flex flex-col h-full px-14 py-12">
          {/* Logo */}
          <motion.button
            onClick={() => setLocation("/")}
            whileHover={{ x: 3 }}
            className="flex items-center gap-3 group w-fit"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shadow-[0_0_20px_hsl(260_84%_63%/0.2)]">
              <ZanixLogo size={22} />
            </div>
            <span className="text-lg font-bold text-white group-hover:text-primary/90 transition-colors">Zanix</span>
            <ChevronLeft className="w-4 h-4 text-white/20 group-hover:text-primary/50 transition-colors rotate-180" />
          </motion.button>

          {/* Main hero */}
          <div className="flex-1 flex flex-col justify-center max-w-sm">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-6">
                <motion.span
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 2, repeat: 9999 }}
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                />
                مباشر · +12,000 مستخدم
              </div>

              <h1 className="text-4xl xl:text-5xl font-display font-black text-white leading-[1.15] mb-4">
                وكيلك الذكي
                <br />
                <span className="text-gradient">الذي ينجز المهام.</span>
              </h1>
              <p className="text-white/45 text-base leading-relaxed mb-8">
                وكيل ذكاء اصطناعي مستقل يفكّر ويخطّط وينفّذ المهام المعقدة — من البداية للنهاية، دون إشراف مستمر.
              </p>

              {/* Features */}
              <div className="space-y-4">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center shrink-0 group-hover:border-primary/30 group-hover:bg-primary/8 transition-all duration-200">
                      <f.icon className="w-4 h-4 text-primary/70 group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/80 leading-tight">{f.label}</p>
                      <p className="text-xs text-white/35 mt-0.5">{f.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Rotating testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-auto"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonialIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="glass-elevated rounded-2xl p-5 border border-white/6"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {TESTIMONIALS[testimonialIdx].avatar}
                  </div>
                  <div>
                    <p className="text-sm text-white/65 leading-relaxed italic">
                      {TESTIMONIALS[testimonialIdx].text}
                    </p>
                    <p className="text-xs text-white/30 mt-2 font-medium">
                      {TESTIMONIALS[testimonialIdx].name} — {TESTIMONIALS[testimonialIdx].role}
                    </p>
                  </div>
                </div>
                {/* Dot indicators */}
                <div className="flex gap-1.5 justify-center mt-4">
                  {TESTIMONIALS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setTestimonialIdx(i)}
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        i === testimonialIdx ? "w-6 bg-primary/70" : "w-2 bg-white/15"
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* ── Right panel (shown on left in RTL): Form ─────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative order-1">
        {/* Subtle bg glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,hsl(260_84%_63%/0.04),transparent)] pointer-events-none" />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <ZanixLogo size={20} />
          </div>
          <span className="text-base font-bold text-white">Zanix AI</span>
        </div>

        <div className="relative w-full max-w-md">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center lg:text-right"
          >
            <h2 className="text-3xl font-display font-bold text-white mb-2">
              {tab === "login" ? "أهلاً بعودتك 👋" : "أنشئ حسابك مجاناً"}
            </h2>
            <p className="text-white/40 text-sm">
              {tab === "login"
                ? "سجّل دخولك للمتابعة مع وكيلك الذكي"
                : "ابدأ الآن — لا تحتاج إلى بطاقة ائتمانية"}
            </p>
          </motion.div>

          {/* Tab switcher */}
          <div className="flex p-1.5 rounded-2xl bg-white/4 border border-white/6 mb-6">
            {(["login", "register"] as const).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-250",
                  tab === t
                    ? "bg-white/10 text-white shadow-sm border border-white/10"
                    : "text-white/35 hover:text-white/60"
                )}
              >
                {t === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
              </button>
            ))}
          </div>

          {/* Server error */}
          <AnimatePresence>
            {serverError && (
              <motion.div
                key="srv-error"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center overflow-hidden"
              >
                {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: tab === "register" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: tab === "register" ? 20 : -20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3.5"
              >
                {tab === "register" && (
                  <Field
                    icon={User}
                    type="text"
                    placeholder="الاسم الكامل"
                    value={name}
                    onChange={setName}
                    error={errors.name}
                  />
                )}

                <Field
                  icon={Mail}
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={email}
                  onChange={setEmail}
                  error={errors.email}
                />

                <div className="space-y-2">
                  <Field
                    icon={Lock}
                    type={showPw ? "text" : "password"}
                    placeholder="كلمة المرور (8 أحرف على الأقل)"
                    value={password}
                    onChange={setPassword}
                    error={errors.password}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPw(p => !p)}
                        className="text-white/25 hover:text-white/60 transition-colors p-1"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />

                  {/* Password strength */}
                  {tab === "register" && password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-1"
                    >
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-all duration-300",
                              strength.score >= i ? strength.color : "bg-white/8"
                            )}
                          />
                        ))}
                      </div>
                      {strength.label && (
                        <p className="text-xs text-white/35 pr-0.5 text-right">
                          قوة كلمة المرور: <span className="font-semibold text-white/60">{strength.label}</span>
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Forgot password */}
                {tab === "login" && (
                  <div className="flex justify-start">
                    <button
                      type="button"
                      className="text-xs text-white/35 hover:text-primary/70 transition-colors"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                )}

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={isPending}
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "relative w-full py-4 mt-2 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2.5 overflow-hidden",
                    "bg-primary hover:bg-primary/92 shadow-[0_4px_24px_hsl(260_84%_63%/0.35)] hover:shadow-[0_6px_32px_hsl(260_84%_63%/0.45)]",
                    "disabled:opacity-60 disabled:cursor-not-allowed"
                  )}
                >
                  {/* Shimmer */}
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2.5, repeat: 9999, ease: "easeInOut", repeatDelay: 1.5 }}
                  />

                  {isPending ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>{tab === "login" ? "جارٍ تسجيل الدخول…" : "جارٍ إنشاء الحساب…"}</span>
                    </div>
                  ) : (
                    <>
                      <span>{tab === "login" ? "تسجيل الدخول" : "ابدأ مجاناً"}</span>
                      <ArrowRight className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </motion.button>

                {/* Terms */}
                {tab === "register" && (
                  <p className="text-center text-xs text-white/25 leading-relaxed">
                    بإنشاء حساب، أنت توافق على{" "}
                    <span className="text-white/45 underline underline-offset-2 cursor-pointer hover:text-primary/60 transition-colors">شروط الخدمة</span>
                    {" "}و{" "}
                    <span className="text-white/45 underline underline-offset-2 cursor-pointer hover:text-primary/60 transition-colors">سياسة الخصوصية</span>
                  </p>
                )}

                {/* Switch tab */}
                <p className="text-center text-sm text-white/30 pt-1">
                  {tab === "login" ? (
                    <>
                      ليس لديك حساب؟{" "}
                      <button type="button" onClick={() => switchTab("register")} className="text-primary/70 hover:text-primary font-semibold transition-colors">
                        أنشئ حساباً مجاناً
                      </button>
                    </>
                  ) : (
                    <>
                      لديك حساب بالفعل؟{" "}
                      <button type="button" onClick={() => switchTab("login")} className="text-primary/70 hover:text-primary font-semibold transition-colors">
                        سجّل دخولك
                      </button>
                    </>
                  )}
                </p>
              </motion.div>
            </AnimatePresence>
          </form>

          {/* Social proof strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-6"
          >
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {["A", "B", "C", "D"].map((l, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-[hsl(228_22%_4%)] bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                  {l}
                </div>
              ))}
            </div>
            <p className="text-xs text-white/30">
              <span className="text-white/50 font-semibold">+12,000</span> مستخدم نشط
            </p>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <Sparkles key={i} className="w-2.5 h-2.5 text-amber-400/70" />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-center text-xs text-white/15">
          © 2026 Zanix AI · جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
