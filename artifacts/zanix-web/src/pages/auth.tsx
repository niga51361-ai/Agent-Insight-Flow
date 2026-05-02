import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2,
  Zap, Shield, Cpu, Sparkles, Globe, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import FeatherLogo from "@/components/feather-logo";
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
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-cyan-500" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

// ── Feature list (left panel) ─────────────────────────────────────
const FEATURES = [
  { icon: Zap, label: "21 professional tools", sub: "Web, code, files, APIs & more" },
  { icon: Cpu, label: "Multi-agent orchestration", sub: "6 parallel agents working for you" },
  { icon: Globe, label: "Persistent memory", sub: "Remembers context across sessions" },
  { icon: Shield, label: "Enterprise-grade security", sub: "End-to-end encryption, SOC 2" },
];

// ── Floating particle ─────────────────────────────────────────────
function Particle({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-primary/40"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{ y: [-10, 10, -10], opacity: [0.2, 0.7, 0.2] }}
      transition={{ duration: 4 + delay, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

// ── Input field ────────────────────────────────────────────────────
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
          className="w-full bg-transparent py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none"
        />
        {rightSlot && <div className="absolute right-3">{rightSlot}</div>}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400 pl-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ── Main Auth Page ─────────────────────────────────────────────────
export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { data: userData } = useGetMe();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const isPending = loginMutation.isPending || registerMutation.isPending;
  const strength = getStrength(password);

  // If already logged in, redirect
  useEffect(() => {
    const user = (userData as any)?.user;
    if (user) {
      setLocation(user.onboardingCompleted ? "/chat" : "/onboarding");
    }
  }, [userData, setLocation]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (tab === "register" && !name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Must be at least 8 characters";
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
      setServerError(
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong. Please try again."
      );
    }
  };

  const switchTab = (t: "login" | "register") => {
    setTab(t);
    setErrors({});
    setServerError("");
    setPassword("");
  };

  const particles = [
    { x: 15, y: 20 }, { x: 75, y: 15 }, { x: 45, y: 60 },
    { x: 85, y: 70 }, { x: 25, y: 80 }, { x: 60, y: 35 },
  ];

  return (
    <div className="min-h-screen flex bg-[hsl(228_22%_4%)] overflow-hidden">

      {/* ── Left panel: Branding ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(260_84%_8%)] via-[hsl(228_22%_5%)] to-[hsl(186_100%_4%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_20%,hsl(260_84%_63%/0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_70%_80%,hsl(186_100%_50%/0.08),transparent)]" />
        <div className="absolute inset-0 dot-grid opacity-20" />

        {/* Floating particles */}
        {particles.map((p, i) => (
          <Particle key={i} x={p.x} y={p.y} delay={i * 0.7} />
        ))}

        {/* Glowing orb */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/12 blur-3xl pointer-events-none"
        />

        <div className="relative flex flex-col h-full px-14 py-12">
          {/* Logo */}
          <motion.button
            onClick={() => setLocation("/")}
            whileHover={{ x: -3 }}
            className="flex items-center gap-3 group w-fit"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shadow-[0_0_20px_hsl(260_84%_63%/0.2)]">
              <FeatherLogo size={22} />
            </div>
            <span className="text-lg font-bold text-white group-hover:text-primary/90 transition-colors">Zanix</span>
            <ChevronLeft className="w-4 h-4 text-white/20 group-hover:text-primary/50 transition-colors -ml-1" />
          </motion.button>

          {/* Main content */}
          <div className="flex-1 flex flex-col justify-center max-w-sm">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-6">
                  <motion.span
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  />
                  Live · 12,000+ users
                </div>
                <h1 className="text-4xl xl:text-5xl font-display font-black text-white leading-[1.1] mb-4">
                  Your AI agent
                  <br />
                  <span className="text-gradient">that ships.</span>
                </h1>
                <p className="text-white/45 text-base leading-relaxed">
                  The autonomous agent that thinks, plans, and executes
                  complex tasks — end to end, without hand-holding.
                </p>
              </div>

              {/* Feature list */}
              <div className="space-y-4">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center shrink-0 group-hover:border-primary/30 group-hover:bg-primary/8 transition-all duration-200">
                      <f.icon className="w-4.5 h-4.5 text-primary/70 group-hover:text-primary transition-colors" />
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

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-auto"
          >
            <div className="glass-elevated rounded-2xl p-5 border border-white/6">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  S
                </div>
                <div>
                  <p className="text-sm text-white/65 leading-relaxed italic">
                    "Zanix cut our research time by 80%. It's like having a genius intern who never sleeps."
                  </p>
                  <p className="text-xs text-white/30 mt-2 font-medium">Sarah M. — Lead Engineer at Acme Corp</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Right panel: Form ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <FeatherLogo size={20} />
          </div>
          <span className="text-base font-bold text-white">Zanix</span>
        </div>

        <div className="w-full max-w-md">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-display font-bold text-white mb-2">
              {tab === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-white/40 text-sm">
              {tab === "login"
                ? "Sign in to continue with your AI agent"
                : "Start free — no credit card required"}
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
                {t === "login" ? "Sign In" : "Create Account"}
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
                initial={{ opacity: 0, x: tab === "register" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: tab === "register" ? -20 : 20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3.5"
              >
                {tab === "register" && (
                  <Field
                    icon={User}
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={setName}
                    error={errors.name}
                  />
                )}

                <Field
                  icon={Mail}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={setEmail}
                  error={errors.email}
                />

                <div className="space-y-2">
                  <Field
                    icon={Lock}
                    type={showPw ? "text" : "password"}
                    placeholder="Password (min. 8 characters)"
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

                  {/* Password strength (register only) */}
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
                        <p className="text-xs text-white/35 pl-0.5">
                          Password strength: <span className="font-semibold text-white/60">{strength.label}</span>
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Forgot password */}
                {tab === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-white/35 hover:text-primary/70 transition-colors"
                    >
                      Forgot password?
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
                    "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  )}
                >
                  {/* Shimmer */}
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                  />

                  {isPending ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>{tab === "login" ? "Signing in…" : "Creating account…"}</span>
                    </div>
                  ) : (
                    <>
                      <span>{tab === "login" ? "Sign In" : "Start for Free"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>

                {/* Terms (register) */}
                {tab === "register" && (
                  <p className="text-center text-xs text-white/25 leading-relaxed">
                    By creating an account you agree to our{" "}
                    <span className="text-white/45 underline underline-offset-2 cursor-pointer hover:text-primary/60 transition-colors">Terms of Service</span>
                    {" "}and{" "}
                    <span className="text-white/45 underline underline-offset-2 cursor-pointer hover:text-primary/60 transition-colors">Privacy Policy</span>
                  </p>
                )}

                {/* Switch tab link */}
                <p className="text-center text-sm text-white/30 pt-1">
                  {tab === "login" ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button type="button" onClick={() => switchTab("register")} className="text-primary/70 hover:text-primary font-semibold transition-colors">
                        Create one free
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button type="button" onClick={() => switchTab("login")} className="text-primary/70 hover:text-primary font-semibold transition-colors">
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </motion.div>
            </AnimatePresence>
          </form>
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-center text-xs text-white/15">
          © 2026 Zanix AI · All rights reserved
        </p>
      </div>
    </div>
  );
}
