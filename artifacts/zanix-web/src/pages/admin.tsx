import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Activity, Settings2, Shield, LogOut,
  ChevronRight, RefreshCw, Trash2, Crown, AlertTriangle,
  CheckCircle2, Cpu, Server, Clock, TrendingUp, Search,
  Edit3, Ban, Zap, Database, KeyRound, Eye, EyeOff,
  Terminal, Sparkles, Plus, Save, RotateCcw, Table2,
  Play, FileText, Copy, Check, ChevronDown, ChevronUp,
  History, Bot, Lock, Unlock, AlertCircle, MemoryStick,
  X, Loader2, Hash, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ZanixLogo from "@/components/zanix-logo";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const api = (path: string) => `${BASE}/api${path}`;

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(api(path), { credentials: "include", ...opts });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw Object.assign(new Error(err.error ?? r.statusText), { status: r.status });
  }
  return r.json();
}

// ─── Types ────────────────────────────────────────────────────────
interface Stats { totalUsers: number; totalTasks: number; totalSessions: number; completedTasks: number; failedTasks: number; runningTasks: number; successRate: number; proUsers: number; adminUsers: number; }
interface AdminUser { id: number; name: string; email: string; plan: "free" | "pro" | "enterprise"; role: "user" | "admin"; agentName: string | null; onboardingCompleted: boolean; createdAt: string; }
interface Task { id: number; taskId: string; sessionId: string; goal: string; status: string; result: string | null; errorMessage: string | null; createdAt: string; completedAt: string | null; }
interface PlatformConfig { id: number; key: string; value: string; description: string | null; updatedAt: string; }
interface Secret { id: number; key: string; description: string | null; hint: string | null; updatedAt: string; }
interface EnvVar { key: string; description: string; set: boolean; source: string; hint: string | null; }
interface DbTable { table_name: string; column_count: number; size: string; row_count: number | string; }
interface AuditLog { id: number; adminId: number; adminEmail: string | null; action: string; target: string | null; details: any; ipAddress: string | null; createdAt: string; }

// ─── Nav ─────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",  label: "لوحة التحكم",     icon: LayoutDashboard },
  { id: "users",      label: "المستخدمون",       icon: Users },
  { id: "tasks",      label: "المهام",            icon: Activity },
  { id: "prompt",     label: "برومت التدريب",    icon: Bot },
  { id: "secrets",    label: "مفاتيح API",       icon: KeyRound },
  { id: "database",   label: "قاعدة البيانات",   icon: Database },
  { id: "agent",      label: "إعداد الوكيل",     icon: Cpu },
  { id: "audit",      label: "سجل الأحداث",      icon: History },
  { id: "system",     label: "مراقبة النظام",    icon: Server },
] as const;
type NavId = (typeof NAV)[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, colorClass, icon: Icon }: { label: string; value: string | number; sub?: string; colorClass: string; icon: any }) {
  return (
    <div className={cn("rounded-2xl border p-4 flex gap-3 items-start", colorClass)}>
      <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-xs font-semibold text-white/50">{label}</p>
        {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const m: Record<string, string> = { free: "text-white/40 bg-white/5 border-white/10", pro: "text-violet-400 bg-violet-500/12 border-violet-500/20", enterprise: "text-cyan-400 bg-cyan-500/12 border-cyan-500/20" };
  const l: Record<string, string> = { free: "مجاني", pro: "Pro", enterprise: "Enterprise" };
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", m[plan] ?? m.free)}>{l[plan] ?? plan}</span>;
}

function StatusPill({ status }: { status: string }) {
  const m: Record<string, string> = { completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", running: "text-blue-400 bg-blue-500/10 border-blue-500/20", failed: "text-red-400 bg-red-500/10 border-red-500/20", pending: "text-amber-400 bg-amber-500/10 border-amber-500/20", cancelled: "text-white/30 bg-white/4 border-white/8" };
  const l: Record<string, string> = { completed: "مكتمل", running: "يعمل", failed: "فاشل", pending: "معلق", cancelled: "ملغى" };
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", m[status] ?? m.cancelled)}>{l[status] ?? status}</span>;
}

function StatusDot({ status }: { status: string }) {
  const m: Record<string, string> = { completed: "bg-emerald-400", running: "bg-blue-400 animate-pulse", failed: "bg-red-400", pending: "bg-amber-400" };
  return <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1", m[status] ?? "bg-white/20")} />;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}س`;
  return `${Math.floor(h / 24)}ي`;
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}ي ${h}س`;
  return `${h}س ${m}د`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="w-6 h-6 rounded-md flex items-center justify-center text-white/25 hover:text-white/60 transition-colors">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const [, navigate] = useLocation();
  const [nav, setNav] = useState<NavId>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [dbTables, setDbTables] = useState<DbTable[]>([]);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const refresh = useCallback(async (section: NavId) => {
    try {
      if (section === "dashboard") {
        const d = await apiFetch("/admin/stats");
        setStats(d.stats); setRecentTasks(d.recentTasks ?? []); setRecentUsers(d.recentUsers ?? []);
      } else if (section === "users") {
        const d = await apiFetch("/admin/users?limit=100");
        setUsers(d.users ?? []);
      } else if (section === "tasks") {
        const d = await apiFetch("/admin/tasks?limit=100");
        setTasks(d.tasks ?? []);
      } else if (section === "prompt") {
        const d = await apiFetch("/admin/config");
        setConfigs(d.configs ?? []);
      } else if (section === "secrets") {
        const d = await apiFetch("/admin/secrets");
        setSecrets(d.secrets ?? []); setEnvVars(d.envStatus ?? []);
      } else if (section === "database") {
        const d = await apiFetch("/admin/db/tables");
        setDbTables(d.tables ?? []);
      } else if (section === "system") {
        const d = await apiFetch("/admin/system");
        setSystemInfo(d);
      } else if (section === "agent") {
        const d = await apiFetch("/admin/agent-config");
        setAgentConfig(d.config);
      } else if (section === "audit") {
        const d = await apiFetch("/admin/audit?limit=100");
        setAuditLogs(d.logs ?? []);
      }
    } catch (e: any) {
      showToast(e.message ?? "خطأ", "err");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const me = await apiFetch("/auth/me");
        if (me.user?.role !== "admin") { navigate("/chat"); return; }
        await refresh("dashboard");
      } catch { navigate("/auth"); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => { if (!loading) refresh(nav); }, [nav]);

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[hsl(228_22%_4%)] flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <ZanixLogo size={24} />
          </div>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/50"
                animate={{ scale: [1,1.5,1], opacity: [0.4,1,0.4] }}
                transition={{ duration: 1, delay: i * 0.2, repeat: 9999 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-[hsl(228_22%_4%)] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto"><Shield className="w-7 h-7 text-red-400" /></div>
          <p className="text-white font-bold">{error}</p>
          <button onClick={() => navigate("/chat")} className="px-4 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-sm">العودة للدردشة</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[hsl(228_22%_4%)] flex" dir="rtl">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={cn("fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-semibold shadow-xl backdrop-blur-xl",
              toast.type === "ok" ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400" : "bg-red-500/15 border-red-500/25 text-red-400")}>
            {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside className={cn("flex flex-col border-l border-white/6 bg-[hsl(228_22%_5%)] transition-all duration-300 shrink-0", sidebarOpen ? "w-56" : "w-14")}>
        <div className="flex items-center gap-2.5 px-3 py-4 border-b border-white/6 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/10 border border-primary/22 flex items-center justify-center shrink-0"><ZanixLogo size={18} /></div>
          {sidebarOpen && <div className="min-w-0 flex-1"><p className="text-xs font-black text-white">Zanix Admin</p><p className="text-[9px] text-primary/60 font-bold uppercase tracking-widest">لوحة الإدارة</p></div>}
          <button onClick={() => setSidebarOpen(p => !p)} className="shrink-0 w-6 h-6 flex items-center justify-center text-white/20 hover:text-white/50 transition-colors">
            <ChevronRight className={cn("w-4 h-4 transition-transform", sidebarOpen ? "rotate-180" : "")} />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setNav(item.id)}
                className={cn("w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all",
                  nav === item.id ? "bg-primary/12 border border-primary/20 text-primary" : "text-white/35 hover:text-white/65 hover:bg-white/4 border border-transparent")}>
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
                {item.id === "secrets" && sidebarOpen && <Lock className="w-2.5 h-2.5 text-amber-400/60 mr-auto shrink-0" />}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-white/6 space-y-1 shrink-0">
          <button onClick={() => navigate("/chat")} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-white/25 hover:text-white/55 hover:bg-white/4 transition-all">
            <Zap className="w-4 h-4 shrink-0 text-primary/50" />{sidebarOpen && <span>العودة للدردشة</span>}
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-red-400/50 hover:text-red-400 hover:bg-red-500/8 transition-all">
            <LogOut className="w-4 h-4 shrink-0" />{sidebarOpen && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-white/6 bg-[hsl(228_22%_4%)] shrink-0">
          <div>
            <h1 className="text-sm font-black text-white">{NAV.find(n => n.id === nav)?.label}</h1>
            <p className="text-[10px] text-white/25 mt-0.5">Zanix AI Control Center</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refresh(nav)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/6 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400/70">مباشر</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {nav === "dashboard" && <DashboardSection stats={stats} recentTasks={recentTasks} recentUsers={recentUsers} setNav={setNav} />}
          {nav === "users" && <UsersSection users={users} onRefresh={() => refresh("users")} showToast={showToast} />}
          {nav === "tasks" && <TasksSection tasks={tasks} onRefresh={() => refresh("tasks")} showToast={showToast} />}
          {nav === "prompt" && <PromptSection configs={configs} onRefresh={() => refresh("prompt")} showToast={showToast} />}
          {nav === "secrets" && <SecretsSection secrets={secrets} envVars={envVars} onRefresh={() => refresh("secrets")} showToast={showToast} />}
          {nav === "database" && <DatabaseSection tables={dbTables} showToast={showToast} />}
          {nav === "agent" && agentConfig && <AgentConfigSection config={agentConfig} />}
          {nav === "audit" && <AuditSection logs={auditLogs} />}
          {nav === "system" && systemInfo && <SystemSection info={systemInfo} />}
        </div>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
function DashboardSection({ stats, recentTasks, recentUsers, setNav }: { stats: Stats | null; recentTasks: Task[]; recentUsers: AdminUser[]; setNav: (n: NavId) => void }) {
  if (!stats) return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-white/25" /></div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="إجمالي المستخدمين" value={stats.totalUsers} sub={`${stats.adminUsers} مدير · ${stats.proUsers} Pro`} colorClass="border-violet-500/15 bg-violet-500/5" icon={Users} />
        <StatCard label="إجمالي المهام" value={stats.totalTasks} sub={`${stats.runningTasks} يعمل الآن`} colorClass="border-blue-500/15 bg-blue-500/5" icon={Activity} />
        <StatCard label="معدل النجاح" value={`${stats.successRate}%`} sub={`${stats.completedTasks} مكتملة · ${stats.failedTasks} فاشلة`} colorClass="border-emerald-500/15 bg-emerald-500/5" icon={TrendingUp} />
        <StatCard label="الجلسات" value={stats.totalSessions} sub="جلسة محادثة" colorClass="border-cyan-500/15 bg-cyan-500/5" icon={Database} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-xs font-bold text-white/60">آخر المهام</p>
            <button onClick={() => setNav("tasks")} className="text-[10px] text-primary/60 hover:text-primary">عرض الكل</button>
          </div>
          <div className="divide-y divide-white/4">
            {recentTasks.length === 0 && <p className="text-xs text-white/20 text-center py-6">لا توجد مهام</p>}
            {recentTasks.map(t => (
              <div key={t.taskId} className="flex items-start gap-3 px-4 py-3">
                <StatusDot status={t.status} />
                <p className="text-xs text-white/55 flex-1 truncate">{t.goal}</p>
                <span className="text-[10px] text-white/20 shrink-0">{timeAgo(t.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-xs font-bold text-white/60">أحدث المستخدمين</p>
            <button onClick={() => setNav("users")} className="text-[10px] text-primary/60 hover:text-primary">عرض الكل</button>
          </div>
          <div className="divide-y divide-white/4">
            {recentUsers.length === 0 && <p className="text-xs text-white/20 text-center py-6">لا يوجد مستخدمون</p>}
            {recentUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{u.name[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/70 truncate">{u.name}</p>
                  <p className="text-[10px] text-white/30 truncate">{u.email}</p>
                </div>
                <PlanBadge plan={u.plan} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════
function UsersSection({ users, onRefresh, showToast }: { users: AdminUser[]; onRefresh: () => void; showToast: (m: string, t?: "ok" | "err") => void }) {
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = users.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const handleUpdate = async (id: number, updates: Partial<AdminUser>) => {
    setLoading(true);
    try {
      await apiFetch(`/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      showToast("تم تحديث المستخدم"); onRefresh(); setEditUser(null);
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    try {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
      showToast("تم حذف المستخدم"); onRefresh(); setDeleteId(null);
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="w-full bg-white/4 border border-white/8 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-all" />
        </div>
        <span className="text-xs text-white/25">{filtered.length} مستخدم</span>
      </div>
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {["المستخدم", "الخطة", "الدور", "الوكيل", "تاريخ الانضمام", ""].map((h, i) => (
                <th key={i} className="text-right text-[10px] font-bold text-white/25 uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{u.name[0]?.toUpperCase()}</div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/70 truncate max-w-[120px]">{u.name}</p>
                        <p className="text-[10px] text-white/30 truncate max-w-[120px]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                  <td className="px-4 py-3">
                    {u.role === "admin"
                      ? <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400 border border-amber-500/20 w-fit"><Crown className="w-2.5 h-2.5" />مدير</span>
                      : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/4 text-white/35 border border-white/8">مستخدم</span>}
                  </td>
                  <td className="px-4 py-3"><span className="text-[11px] text-white/30">{u.agentName ?? "—"}</span></td>
                  <td className="px-4 py-3"><span className="text-[11px] text-white/25">{new Date(u.createdAt).toLocaleDateString("ar")}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditUser(u)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-primary hover:bg-primary/8 transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(u.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/8 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-xs text-white/20">لا يوجد مستخدمون</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="تعديل المستخدم" icon={<Edit3 className="w-4 h-4 text-primary" />}>
        {editUser && <EditUserForm user={editUser} onSave={u => handleUpdate(editUser.id, u)} onCancel={() => setEditUser(null)} loading={loading} />}
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="تأكيد الحذف" icon={<AlertTriangle className="w-4 h-4 text-red-400" />} danger>
        <p className="text-xs text-white/45 mb-4">هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المستخدم وجميع بياناته.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/45 hover:bg-white/4 transition-all">إلغاء</button>
          <button onClick={() => deleteId !== null && handleDelete(deleteId)} disabled={loading} className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-bold transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "حذف نهائي"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function EditUserForm({ user, onSave, onCancel, loading }: { user: AdminUser; onSave: (u: Partial<AdminUser>) => void; onCancel: () => void; loading: boolean }) {
  const [role, setRole] = useState(user.role);
  const [plan, setPlan] = useState(user.plan);
  const [name, setName] = useState(user.name);
  return (
    <div className="space-y-3">
      <Field label="الاسم"><input value={name} onChange={e => setName(e.target.value)} className="input-base" /></Field>
      <Field label="الدور">
        <div className="flex gap-2">
          {(["user", "admin"] as const).map(r => (
            <button key={r} onClick={() => setRole(r)} className={cn("flex-1 py-2 rounded-xl text-xs font-bold border transition-all", role === r ? "bg-primary/15 border-primary/25 text-primary" : "bg-white/4 border-white/8 text-white/40 hover:border-white/16")}>
              {r === "admin" ? <><Crown className="w-3 h-3 inline ml-1" />مدير</> : "مستخدم"}
            </button>
          ))}
        </div>
      </Field>
      <Field label="الخطة">
        <div className="flex gap-2">
          {(["free", "pro", "enterprise"] as const).map(p => (
            <button key={p} onClick={() => setPlan(p)} className={cn("flex-1 py-2 rounded-xl text-xs font-bold border transition-all", plan === p ? "bg-primary/15 border-primary/25 text-primary" : "bg-white/4 border-white/8 text-white/40 hover:border-white/16")}>
              {p === "free" ? "مجاني" : p === "pro" ? "Pro" : "Enterprise"}
            </button>
          ))}
        </div>
      </Field>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:bg-white/4 transition-all">إلغاء</button>
        <button onClick={() => onSave({ role, plan, name })} disabled={loading} className="flex-1 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-bold transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "حفظ"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════════════════════════
function TasksSection({ tasks, onRefresh, showToast }: { tasks: Task[]; onRefresh: () => void; showToast: (m: string, t?: "ok" | "err") => void }) {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[["all","الكل"], ["running","يعمل"], ["completed","مكتمل"], ["failed","فاشل"], ["pending","معلق"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn("px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all",
            filter === v ? "bg-primary/15 border-primary/25 text-primary" : "bg-white/4 border-white/8 text-white/40 hover:border-white/15")}>
            {l} <span className="ml-1 text-[9px] opacity-60">{v === "all" ? tasks.length : (counts[v] ?? 0)}</span>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden divide-y divide-white/[0.04]">
        {filtered.length === 0 && <p className="text-xs text-white/20 text-center py-8">لا توجد مهام</p>}
        {filtered.map(t => (
          <div key={t.taskId}>
            <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setExpanded(expanded === t.taskId ? null : t.taskId)}>
              <StatusDot status={t.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/65 leading-relaxed line-clamp-1">{t.goal}</p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px] text-white/20 font-mono">{t.taskId.slice(0, 16)}…</span>
                  <span className="text-[10px] text-white/20">{timeAgo(t.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill status={t.status} />
                {expanded === t.taskId ? <ChevronUp className="w-3.5 h-3.5 text-white/20" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
              </div>
            </div>
            <AnimatePresence>
              {expanded === t.taskId && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-2 bg-white/[0.01]">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div><span className="text-white/30">Task ID: </span><span className="font-mono text-white/50 break-all">{t.taskId}</span></div>
                      <div><span className="text-white/30">Session: </span><span className="font-mono text-white/50">{t.sessionId}</span></div>
                      {t.completedAt && <div><span className="text-white/30">اكتمل: </span><span className="text-white/50">{new Date(t.completedAt).toLocaleString("ar")}</span></div>}
                    </div>
                    {t.result && (
                      <div>
                        <p className="text-[10px] text-white/30 mb-1">النتيجة:</p>
                        <p className="text-[11px] text-white/50 bg-white/3 border border-white/6 rounded-xl p-3 leading-relaxed max-h-32 overflow-y-auto">{t.result}</p>
                      </div>
                    )}
                    {t.errorMessage && (
                      <div>
                        <p className="text-[10px] text-red-400/60 mb-1">الخطأ:</p>
                        <p className="text-[11px] text-red-400/60 bg-red-500/5 border border-red-500/15 rounded-xl p-3 leading-relaxed">{t.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SYSTEM PROMPT & CONFIG
// ════════════════════════════════════════════════════════════════
function PromptSection({ configs, onRefresh, showToast }: { configs: PlatformConfig[]; onRefresh: () => void; showToast: (m: string, t?: "ok" | "err") => void }) {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const DEFAULT_SYSTEM_PROMPT = `You are Zanix ⚡, an elite autonomous AI agent built by Zanix AI. You are fast, direct, brilliant, and highly capable.

## 🚀 Speed First:
- Answer DIRECTLY and IMMEDIATELY from your knowledge for any question you can.
- DO NOT use tools unless you genuinely need live/external data.
- Simple questions → answer in ONE response with no tool calls.

## 🌟 Communication style:
- USE EMOJIS naturally throughout ALL responses.
- Match user language — Arabic input → Arabic reply.
- Be warm, enthusiastic, and engaging.

## 📝 Response quality:
1. Match user language — Arabic input → Arabic reply
2. Be direct and complete — full answer, not a plan
3. Format beautifully — markdown headers, bullets, code blocks
4. Use emojis in every section header and key point`;

  const startEdit = (key: string, val: string) => { setEditKey(key); setEditVal(val); };

  const handleSave = async () => {
    if (!editKey) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/config/${editKey}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: editVal }) });
      showToast("تم حفظ الإعداد"); onRefresh(); setEditKey(null);
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setSaving(false); }
  };

  const getVal = (key: string, fallback: string) => configs.find(c => c.key === key)?.value ?? fallback;

  return (
    <div className="space-y-5">
      {/* System Prompt */}
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-primary" /></div>
            <div>
              <p className="text-xs font-bold text-white/70">برومت النظام (System Prompt)</p>
              <p className="text-[10px] text-white/30">التعليمات الأساسية للوكيل — يتم تطبيقه على كل المحادثات</p>
            </div>
          </div>
          <button onClick={() => startEdit("system_prompt", getVal("system_prompt", DEFAULT_SYSTEM_PROMPT))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/18 transition-all">
            <Edit3 className="w-3 h-3" /> تعديل
          </button>
        </div>
        <div className="p-4">
          <pre className="text-[11px] text-white/45 leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto bg-white/3 border border-white/5 rounded-xl p-3">
            {getVal("system_prompt", DEFAULT_SYSTEM_PROMPT)}
          </pre>
        </div>
      </div>

      {/* Other Config */}
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-xs font-bold text-white/60">إعدادات النظام</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {[
            { key: "default_model", label: "النموذج الافتراضي", desc: "النموذج المستخدم عند بدء المحادثة" },
            { key: "max_iterations", label: "الحد الأقصى للتكرارات", desc: "عدد خطوات الوكيل في المهمة الواحدة" },
            { key: "max_tokens", label: "الحد الأقصى للتوكن", desc: "عدد توكنات الإخراج القصوى" },
            { key: "streaming_enabled", label: "البث المباشر (Streaming)", desc: "تفعيل SSE للردود التدريجية" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-xs font-semibold text-white/65">{item.label}</p>
                <p className="text-[10px] text-white/30">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white/50 bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg">{getVal(item.key, "—")}</span>
                <button onClick={() => startEdit(item.key, getVal(item.key, ""))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-primary hover:bg-primary/8 transition-all">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={!!editKey} onClose={() => setEditKey(null)} title={`تعديل: ${editKey}`} icon={<Edit3 className="w-4 h-4 text-primary" />} wide={editKey === "system_prompt"}>
        <div className="space-y-3">
          {editKey === "system_prompt" ? (
            <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={16}
              className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-white/70 font-mono focus:outline-none focus:border-primary/40 transition-all resize-none leading-relaxed" />
          ) : (
            <input value={editVal} onChange={e => setEditVal(e.target.value)}
              className="w-full bg-white/4 border border-white/8 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary/40 transition-all" />
          )}
          <div className="flex gap-2">
            <button onClick={() => setEditKey(null)} className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:bg-white/4">إلغاء</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> حفظ</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECRETS (API KEYS)
// ════════════════════════════════════════════════════════════════
function SecretsSection({ secrets, envVars, onRefresh, showToast }: { secrets: Secret[]; envVars: EnvVar[]; onRefresh: () => void; showToast: (m: string, t?: "ok" | "err") => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editSecret, setEditSecret] = useState<Secret | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ key: "", value: "", description: "" });

  const handleUpsert = async () => {
    if (!form.key || !form.value) { showToast("المفتاح والقيمة مطلوبان", "err"); return; }
    setLoading(true);
    try {
      await apiFetch("/admin/secrets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      showToast("تم حفظ المفتاح بأمان"); onRefresh(); setAddOpen(false); setEditSecret(null); setForm({ key: "", value: "", description: "" });
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (key: string) => {
    setLoading(true);
    try {
      await apiFetch(`/admin/secrets/${key}`, { method: "DELETE" });
      showToast("تم حذف المفتاح"); onRefresh(); setDeleteKey(null);
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setLoading(false); }
  };

  const openEdit = (s: Secret) => { setForm({ key: s.key, value: "", description: s.description ?? "" }); setEditSecret(s); };

  return (
    <div className="space-y-5">
      {/* Security notice */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/6 border border-amber-500/15">
        <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-400/90 mb-1">الأمان أولاً</p>
          <p className="text-[11px] text-white/40 leading-relaxed">جميع المفاتيح تُخزَّن مشفّرة بـ AES-256-GCM باستخدام Session Secret. القيم الحقيقية لا تُعرض أبداً في الواجهة. يتم تطبيق المفاتيح فوراً على الخادم دون إعادة تشغيل.</p>
        </div>
      </div>

      {/* DB Secrets */}
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-amber-400/70" />
            <p className="text-xs font-bold text-white/60">المفاتيح المُدارة (مخزّنة مشفّرة في DB)</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHints(p => !p)} className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/55 transition-colors px-2 py-1 rounded-lg hover:bg-white/4">
              {showHints ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showHints ? "إخفاء التلميحات" : "عرض التلميحات"}
            </button>
            <button onClick={() => { setForm({ key: "", value: "", description: "" }); setAddOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/12 border border-primary/22 text-primary text-xs font-bold hover:bg-primary/18 transition-all">
              <Plus className="w-3.5 h-3.5" /> إضافة مفتاح
            </button>
          </div>
        </div>
        {secrets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="w-10 h-10 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center"><KeyRound className="w-5 h-5 text-white/15" /></div>
            <p className="text-xs text-white/25">لا توجد مفاتيح مُضافة بعد</p>
            <button onClick={() => { setForm({ key: "", value: "", description: "" }); setAddOpen(true); }} className="text-xs text-primary/60 hover:text-primary transition-colors">+ أضف أول مفتاح</button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {secrets.map(s => (
              <div key={s.key} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center shrink-0"><KeyRound className="w-3.5 h-3.5 text-amber-400/70" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white/70 font-mono">{s.key}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">مُشفَّر</span>
                  </div>
                  {s.description && <p className="text-[10px] text-white/30">{s.description}</p>}
                  {showHints && s.hint && <p className="text-[10px] font-mono text-white/25 mt-0.5">{s.hint}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-white/20">{timeAgo(s.updatedAt)}</span>
                  <button onClick={() => openEdit(s)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-primary hover:bg-primary/8 transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteKey(s.key)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/8 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Env Vars */}
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2.5">
          <Server className="w-4 h-4 text-white/30" />
          <div>
            <p className="text-xs font-bold text-white/60">متغيرات البيئة (Environment)</p>
            <p className="text-[10px] text-white/25">قراءة فقط — تعديلها من إعدادات Replit</p>
          </div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {envVars.map(e => (
            <div key={e.key} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className={cn("w-2 h-2 rounded-full shrink-0", e.set ? "bg-emerald-400" : "bg-white/15")} />
                <div>
                  <p className="text-[11px] font-mono text-white/55">{e.key}</p>
                  <p className="text-[10px] text-white/25">{e.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {e.set && showHints && e.hint && <span className="text-[10px] font-mono text-white/20">{e.hint}</span>}
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", e.set ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-white/25 bg-white/4 border-white/8")}>
                  {e.set ? "مُعيَّن" : "غير مُعيَّن"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={addOpen || !!editSecret} onClose={() => { setAddOpen(false); setEditSecret(null); }} title={editSecret ? `تعديل: ${editSecret.key}` : "إضافة مفتاح جديد"} icon={<KeyRound className="w-4 h-4 text-amber-400" />}>
        <div className="space-y-3">
          <Field label="اسم المفتاح (KEY)">
            <input value={form.key} onChange={e => setForm(p => ({ ...p, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
              disabled={!!editSecret} placeholder="OPENAI_API_KEY"
              className={cn("input-base font-mono", editSecret && "opacity-50 cursor-not-allowed")} />
            <p className="text-[10px] text-white/25 mt-1">أحرف كبيرة وأرقام وشرطة سفلية فقط</p>
          </Field>
          <Field label="القيمة (VALUE)">
            <PasswordInput value={form.value} onChange={v => setForm(p => ({ ...p, value: v }))} placeholder={editSecret ? "اترك فارغاً للإبقاء على الحالية" : "sk-..."} />
          </Field>
          <Field label="الوصف (اختياري)">
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف قصير للمفتاح" className="input-base" />
          </Field>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setAddOpen(false); setEditSecret(null); }} className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:bg-white/4">إلغاء</button>
            <button onClick={handleUpsert} disabled={loading || !form.key || (!form.value && !editSecret)} className="flex-1 py-2 rounded-xl bg-amber-500/12 border border-amber-500/22 text-amber-400 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Lock className="w-3 h-3" /> حفظ مشفَّر</>}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteKey} onClose={() => setDeleteKey(null)} title="حذف المفتاح" icon={<AlertTriangle className="w-4 h-4 text-red-400" />} danger>
        <p className="text-xs text-white/40 mb-4">سيتم حذف <span className="font-mono text-white/60">{deleteKey}</span> نهائياً من DB وإزالته من الذاكرة فوراً.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteKey(null)} className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/40">إلغاء</button>
          <button onClick={() => deleteKey && handleDelete(deleteKey)} disabled={loading} className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-bold disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "حذف"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DATABASE EXPLORER
// ════════════════════════════════════════════════════════════════
function DatabaseSection({ tables, showToast }: { tables: DbTable[]; showToast: (m: string, t?: "ok" | "err") => void }) {
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{ columns: any[]; rows: any[]; total: number; page: number } | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users LIMIT 20");
  const [sqlResult, setSqlResult] = useState<{ rows: any[]; rowCount: number; duration: number } | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"browse" | "query">("browse");

  const loadTable = async (name: string, p = 1) => {
    setTableLoading(true); setActiveTable(name); setPage(p);
    try {
      const d = await apiFetch(`/admin/db/table/${name}?page=${p}&limit=50`);
      setTableData(d);
    } catch (e: any) { showToast(e.message, "err"); }
    finally { setTableLoading(false); }
  };

  const runQuery = async () => {
    setSqlRunning(true); setSqlError(null); setSqlResult(null);
    try {
      const d = await apiFetch("/admin/db/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: sqlQuery }) });
      setSqlResult(d);
    } catch (e: any) { setSqlError(e.message); }
    finally { setSqlRunning(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-white/4 border border-white/8 rounded-xl w-fit">
        {(["browse","query"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", tab === t ? "bg-primary/15 border border-primary/25 text-primary" : "text-white/35 hover:text-white/60")}>
            {t === "browse" ? <><Table2 className="w-3.5 h-3.5 inline ml-1.5" />تصفح الجداول</> : <><Terminal className="w-3.5 h-3.5 inline ml-1.5" />SQL Console</>}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Tables list */}
          <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
            <div className="px-3 py-2.5 border-b border-white/5">
              <p className="text-xs font-bold text-white/50">الجداول ({tables.length})</p>
            </div>
            <div className="overflow-y-auto max-h-[600px] divide-y divide-white/[0.04]">
              {tables.map(t => (
                <button key={t.table_name} onClick={() => loadTable(t.table_name)}
                  className={cn("w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/4 transition-colors text-right", activeTable === t.table_name && "bg-primary/8")}>
                  <div className="min-w-0">
                    <p className={cn("text-[11px] font-semibold truncate", activeTable === t.table_name ? "text-primary" : "text-white/60")}>{t.table_name}</p>
                    <p className="text-[9px] text-white/25">{t.column_count} عمود · {t.size}</p>
                  </div>
                  <span className={cn("text-[10px] font-mono shrink-0 ml-2", activeTable === t.table_name ? "text-primary/70" : "text-white/25")}>
                    {typeof t.row_count === "number" ? t.row_count.toLocaleString() : t.row_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table data */}
          <div className="lg:col-span-2 rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
            {!activeTable && (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Table2 className="w-8 h-8 text-white/10" />
                <p className="text-xs text-white/20">اختر جدولاً من القائمة</p>
              </div>
            )}
            {activeTable && tableLoading && (
              <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-white/25" /></div>
            )}
            {activeTable && !tableLoading && tableData && (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                  <p className="text-xs font-bold text-white/60 font-mono">{activeTable}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/25">{tableData.total.toLocaleString()} صف</span>
                    <div className="flex gap-1">
                      <button disabled={page <= 1} onClick={() => loadTable(activeTable, page - 1)} className="w-6 h-6 rounded-md flex items-center justify-center text-white/25 hover:text-white/60 disabled:opacity-30 transition-colors"><ChevronUp className="w-3 h-3 rotate-90 -rotate-90" /></button>
                      <span className="text-[10px] text-white/30 px-1">ص {page}</span>
                      <button disabled={page * 50 >= tableData.total} onClick={() => loadTable(activeTable, page + 1)} className="w-6 h-6 rounded-md flex items-center justify-center text-white/25 hover:text-white/60 disabled:opacity-30 transition-colors"><ChevronDown className="w-3 h-3 rotate-90 rotate-90" /></button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-[hsl(228_22%_5%)] z-10">
                      <tr>{tableData.columns.map(c => (
                        <th key={c.column_name} className="text-right text-[9px] font-bold text-white/30 uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-white/5">
                          {c.column_name}<span className="text-white/15 ml-1 font-normal normal-case">{c.data_type}</span>
                        </th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {tableData.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          {tableData.columns.map(c => {
                            const val = row[c.column_name];
                            const isSecret = c.column_name.includes("password") || c.column_name.includes("encrypted") || c.column_name === "session";
                            const display = isSecret ? "••••••••" : (val === null ? <span className="text-white/15 italic">null</span> : String(val).slice(0, 80));
                            return (
                              <td key={c.column_name} className="px-3 py-2 text-white/45 whitespace-nowrap max-w-[200px] truncate font-mono">
                                {display}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "query" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
              <div className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-white/30" /><p className="text-xs font-bold text-white/50">SQL Console</p></div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/25">SELECT فقط · حد 100 صف</span>
                <button onClick={runQuery} disabled={sqlRunning || !sqlQuery.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/12 border border-emerald-500/22 text-emerald-400 text-xs font-bold hover:bg-emerald-500/18 disabled:opacity-50 transition-all">
                  {sqlRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Play className="w-3 h-3" /> تشغيل</>}
                </button>
              </div>
            </div>
            <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
              rows={5} className="w-full bg-transparent px-4 py-3 text-xs font-mono text-white/65 focus:outline-none resize-none leading-relaxed border-b border-white/5"
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runQuery(); }}
              placeholder="SELECT * FROM users LIMIT 20;" />
            <p className="text-[10px] text-white/20 px-4 py-2">Ctrl+Enter للتشغيل</p>
          </div>

          {sqlError && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/6 border border-red-500/15">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400/80 font-mono">{sqlError}</p>
            </div>
          )}

          {sqlResult && (
            <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <p className="text-xs font-bold text-white/50">{sqlResult.rowCount ?? 0} نتيجة</p>
                <span className="text-[10px] text-white/25">{sqlResult.duration}ms</span>
              </div>
              {sqlResult.rows.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-6">لا توجد نتائج</p>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-[hsl(228_22%_5%)]">
                      <tr>{Object.keys(sqlResult.rows[0]).map(k => (
                        <th key={k} className="text-right text-[9px] font-bold text-white/30 uppercase tracking-wider px-3 py-2 border-b border-white/5 whitespace-nowrap">{k}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {sqlResult.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          {Object.values(row).map((v: any, j) => (
                            <td key={j} className="px-3 py-2 text-white/45 font-mono whitespace-nowrap max-w-[200px] truncate">
                              {v === null ? <span className="text-white/15 italic">null</span> : String(v).slice(0, 100)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AGENT CONFIG
// ════════════════════════════════════════════════════════════════
function AgentConfigSection({ config }: { config: any }) {
  const [toolStates, setToolStates] = useState<Record<string, boolean>>(config.tools ?? {});

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/12 border border-primary/20 flex items-center justify-center"><Bot className="w-4 h-4 text-primary" /></div>
          <p className="text-sm font-bold text-white/75">إعدادات النماذج</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {config.availableModels.map((m: any) => (
            <div key={m.id} className={cn("p-3.5 rounded-xl border transition-all", config.defaultModel === m.id ? "bg-primary/10 border-primary/25" : "bg-white/3 border-white/6")}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-white/80">{m.label}</p>
                {config.defaultModel === m.id && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">افتراضي</span>}
              </div>
              <p className="text-[10px] text-white/35 leading-relaxed">{m.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-mono text-white/20">{m.id}</span>
                <span className="text-[10px] text-white/30">{m.tokens}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[["الحد الأقصى للتكرارات", config.maxIterations], ["الحد الأقصى للتوكن", config.maxTokens.toLocaleString()], ["البث المباشر", config.streamingEnabled ? "مُفعَّل" : "معطَّل"]].map(([l, v], i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/6">
              <span className="text-xs text-white/40">{l}</span>
              <span className="text-xs font-bold text-white/65">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/6 bg-white/[0.015] p-5 space-y-3">
        <p className="text-sm font-bold text-white/75">الأدوات المُسجَّلة ({Object.keys(toolStates).length})</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(toolStates).map(([key, enabled]) => (
            <button key={key} onClick={() => setToolStates(p => ({ ...p, [key]: !p[key] }))}
              className={cn("flex items-center justify-between p-2.5 rounded-xl border transition-all", enabled ? "bg-white/4 border-white/8 hover:border-white/14" : "bg-white/[0.02] border-white/5 opacity-60")}>
              <span className="text-[11px] text-white/50 font-mono truncate">{key}</span>
              <span className={cn("w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mr-1", enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-white/4 text-white/20")}>
                {enabled ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AUDIT LOG
// ════════════════════════════════════════════════════════════════
function AuditSection({ logs }: { logs: AuditLog[] }) {
  const actionColors: Record<string, string> = {
    update_user: "text-blue-400 bg-blue-500/10 border-blue-500/15",
    delete_user: "text-red-400 bg-red-500/10 border-red-500/15",
    upsert_secret: "text-amber-400 bg-amber-500/10 border-amber-500/15",
    delete_secret: "text-red-400 bg-red-500/10 border-red-500/15",
    update_config: "text-violet-400 bg-violet-500/10 border-violet-500/15",
    db_query: "text-cyan-400 bg-cyan-500/10 border-cyan-500/15",
  };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden divide-y divide-white/[0.04]">
        {logs.length === 0 && <p className="text-xs text-white/20 text-center py-8">لا توجد أحداث</p>}
        {logs.map(log => (
          <div key={log.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
            <div className="w-7 h-7 rounded-lg bg-white/4 border border-white/6 flex items-center justify-center shrink-0"><History className="w-3.5 h-3.5 text-white/30" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", actionColors[log.action] ?? "text-white/30 bg-white/4 border-white/8")}>{log.action}</span>
                {log.target && <span className="text-[10px] text-white/30 font-mono">{log.target}</span>}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-white/40">{log.adminEmail ?? `admin #${log.adminId}`}</span>
                {log.ipAddress && <span className="text-[10px] text-white/20 font-mono">{log.ipAddress}</span>}
                <span className="text-[10px] text-white/20">{new Date(log.createdAt).toLocaleString("ar")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SYSTEM
// ════════════════════════════════════════════════════════════════
function SystemSection({ info }: { info: any }) {
  const memPct = Math.round((info.memory.heapUsed / info.memory.heapTotal) * 100);
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "وقت التشغيل", value: formatUptime(info.uptime), icon: Clock, color: "border-blue-500/15 bg-blue-500/5" },
          { label: "الذاكرة", value: `${info.memory.heapUsed}MB`, sub: `من ${info.memory.heapTotal}MB (${memPct}%)`, icon: MemoryStick, color: memPct > 80 ? "border-red-500/15 bg-red-500/5" : "border-emerald-500/15 bg-emerald-500/5" },
          { label: "Node.js", value: info.nodeVersion, sub: `${info.platform} · ${info.arch}`, icon: Terminal, color: "border-violet-500/15 bg-violet-500/5" },
          { label: "PID", value: info.pid, sub: "معرّف العملية", icon: Hash, color: "border-white/8 bg-white/[0.02]" },
        ].map((c, i) => <StatCard key={i} label={c.label} value={c.value} sub={c.sub} colorClass={c.color} icon={c.icon} />)}
      </div>

      {info.tasksByStatus && (
        <div className="rounded-2xl border border-white/6 bg-white/[0.015] p-4 space-y-3">
          <p className="text-xs font-bold text-white/55">توزيع حالة المهام</p>
          <div className="grid grid-cols-4 gap-2">
            {[["معلق","pending","amber"],["يعمل","running","blue"],["مكتمل","completed","emerald"],["فاشل","failed","red"]].map(([l,k,c]) => (
              <div key={k} className={`text-center p-3 rounded-xl bg-${c}-500/5 border border-${c}-500/12`}>
                <p className={`text-xl font-black text-${c}-400`}>{info.tasksByStatus[k] ?? 0}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/6 bg-white/[0.015] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-white/30" />
          <p className="text-xs font-bold text-white/55">متغيرات البيئة</p>
          <span className="text-[10px] text-white/20 mr-1">• القيم محمية</span>
        </div>
        <div className="space-y-2">
          {info.envStatus.map((e: any) => (
            <div key={e.key} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/6">
              <div className="flex items-center gap-2.5">
                <span className={cn("w-2 h-2 rounded-full", e.set ? "bg-emerald-400" : "bg-white/15")} />
                <div>
                  <span className="text-[11px] font-mono text-white/50">{e.key}</span>
                  <span className="text-[10px] text-white/25 mr-2">{e.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {e.hint && <span className="text-[10px] font-mono text-white/20">{e.hint}</span>}
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", e.set ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-white/20 bg-white/4 border-white/8")}>
                  {e.set ? "✓ مُعيَّن" : "✗ غير مُعيَّن"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ════════════════════════════════════════════════════════════════
function Modal({ open, onClose, title, icon, children, danger = false, wide = false }: { open: boolean; onClose: () => void; title: string; icon: React.ReactNode; children: React.ReactNode; danger?: boolean; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div initial={{ scale: 0.93, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 12 }}
            className={cn("w-full bg-[hsl(228_22%_6%)] border rounded-2xl p-5 space-y-4 shadow-2xl", danger ? "border-red-500/15" : "border-white/10", wide ? "max-w-2xl" : "max-w-sm")}>
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", danger ? "bg-red-500/10 border border-red-500/15" : "bg-primary/12 border border-primary/20")}>
                {icon}
              </div>
              <p className="text-sm font-bold text-white">{title}</p>
              <button onClick={onClose} className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white/55 hover:bg-white/6 transition-all"><X className="w-3.5 h-3.5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="input-base pl-9 font-mono" />
      <button type="button" onClick={() => setShow(p => !p)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/55 transition-colors">
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
