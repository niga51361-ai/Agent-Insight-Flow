import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Bot, Activity, Settings2,
  Shield, LogOut, ChevronRight, RefreshCw, Trash2,
  Crown, UserCheck, AlertTriangle, CheckCircle2,
  Cpu, Server, MemoryStick, Clock, TrendingUp,
  Search, Filter, MoreVertical, Edit3, Ban,
  ToggleLeft, ToggleRight, Zap, Database,
  KeyRound, Eye, EyeOff, Terminal, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ZanixLogo from "@/components/zanix-logo";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const api = (path: string) => `${BASE}/api${path}`;

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(api(path), { credentials: "include", ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── Types ────────────────────────────────────────────────────────
interface Stats {
  totalUsers: number;
  totalTasks: number;
  totalSessions: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  successRate: number;
  proUsers: number;
  adminUsers: number;
}

interface AdminUser {
  id: number;
  name: string;
  email: string;
  plan: "free" | "pro" | "enterprise";
  role: "user" | "admin";
  agentName: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
}

interface Task {
  id: number;
  taskId: string;
  sessionId: string;
  goal: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  createdAt: string;
  completedAt: string | null;
}

interface SystemInfo {
  uptime: number;
  memory: { heapUsed: number; heapTotal: number; rss: number };
  nodeVersion: string;
  platform: string;
  envStatus: { key: string; set: boolean; preview: string | null }[];
  tasksByStatus: { pending: number; running: number; completed: number; failed: number };
}

// ─── Nav Items ────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",  label: "لوحة التحكم",   icon: LayoutDashboard },
  { id: "users",      label: "المستخدمون",     icon: Users },
  { id: "tasks",      label: "المهام",          icon: Activity },
  { id: "agent",      label: "إعداد الوكيل",   icon: Bot },
  { id: "system",     label: "مراقبة النظام",  icon: Server },
] as const;
type NavId = (typeof NAV)[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: any;
}) {
  return (
    <div className={cn("rounded-2xl border p-4 flex items-start gap-3", color)}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/8 shrink-0">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-black text-white tracking-tight">{value}</p>
        <p className="text-xs font-semibold text-white/55 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Badge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    free: "text-white/40 bg-white/6 border-white/10",
    pro: "text-violet-400 bg-violet-500/12 border-violet-500/20",
    enterprise: "text-cyan-400 bg-cyan-500/12 border-cyan-500/20",
  };
  const labels: Record<string, string> = { free: "مجاني", pro: "Pro", enterprise: "Enterprise" };
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", map[plan] ?? map.free)}>
      {labels[plan] ?? plan}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-400",
    running: "bg-blue-400 animate-pulse",
    pending: "bg-amber-400",
    failed: "bg-red-400",
    cancelled: "bg-white/25",
  };
  return <span className={cn("w-2 h-2 rounded-full shrink-0", map[status] ?? "bg-white/20")} />;
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}س ${m}د`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ساعة`;
  return `${Math.floor(hrs / 24)} يوم`;
}

// ─── Main Component ───────────────────────────────────────────────
export default function AdminPage() {
  const [, navigate] = useLocation();
  const [activeNav, setActiveNav] = useState<NavId>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const loadDashboard = async () => {
    setRefreshing(true);
    try {
      const data = await apiFetch("/admin/stats");
      setStats(data.stats);
      setRecentTasks(data.recentTasks ?? []);
      setRecentUsers(data.recentUsers ?? []);
    } catch {
      setError("غير مسموح بالوصول أو خطأ في الخادم");
    } finally {
      setRefreshing(false);
    }
  };

  const loadUsers = async () => {
    const data = await apiFetch("/admin/users?limit=50");
    setUsers(data.users ?? []);
  };

  const loadTasks = async () => {
    const data = await apiFetch("/admin/tasks?limit=50");
    setTasks(data.tasks ?? []);
  };

  const loadSystem = async () => {
    const data = await apiFetch("/admin/system");
    setSystemInfo(data);
  };

  const loadAgentConfig = async () => {
    const data = await apiFetch("/admin/agent-config");
    setAgentConfig(data.config);
  };

  useEffect(() => {
    const checkAndLoad = async () => {
      setLoading(true);
      try {
        const me = await apiFetch("/auth/me");
        if (me.user?.role !== "admin") {
          navigate("/chat");
          return;
        }
        await loadDashboard();
      } catch {
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    };
    checkAndLoad();
  }, []);

  useEffect(() => {
    if (activeNav === "users") loadUsers();
    else if (activeNav === "tasks") loadTasks();
    else if (activeNav === "system") loadSystem();
    else if (activeNav === "agent") loadAgentConfig();
    else if (activeNav === "dashboard") loadDashboard();
  }, [activeNav]);

  const handleUpdateUser = async (userId: number, updates: Partial<AdminUser>) => {
    setActionLoading(true);
    try {
      const data = await apiFetch(`/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...data.user } : u)));
      setEditingUser(null);
      showSuccess("تم تحديث المستخدم بنجاح");
    } catch (e: any) {
      alert("خطأ: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    setActionLoading(true);
    try {
      await apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
      setUsers(prev => prev.filter(u => u.id !== userId));
      setConfirmDelete(null);
      showSuccess("تم حذف المستخدم");
    } catch (e: any) {
      alert("خطأ: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
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
            {[0, 1, 2].map(i => (
              <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/50"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
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
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-white font-bold">{error}</p>
          <button onClick={() => navigate("/chat")}
            className="px-4 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-sm">
            العودة للدردشة
          </button>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u =>
    userSearch ? (u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())) : true
  );
  const filteredTasks = tasks.filter(t => taskFilter === "all" ? true : t.status === taskFilter);

  return (
    <div className="min-h-dvh bg-[hsl(228_22%_4%)] flex" dir="rtl">

      {/* ── Success Toast ── */}
      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold shadow-xl backdrop-blur-xl">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside className={cn(
        "flex flex-col border-l border-white/6 bg-[hsl(228_22%_5%)] transition-all duration-300 shrink-0",
        sidebarOpen ? "w-56" : "w-14"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-3.5 py-4 border-b border-white/6 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/10 border border-primary/22 flex items-center justify-center shrink-0">
            <ZanixLogo size={18} />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white tracking-tight">Zanix Admin</p>
              <p className="text-[9px] text-primary/60 font-bold uppercase tracking-widest">لوحة الإدارة</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(p => !p)} className="shrink-0 w-6 h-6 flex items-center justify-center text-white/20 hover:text-white/50 transition-colors">
            <ChevronRight className={cn("w-4 h-4 transition-transform", sidebarOpen ? "rotate-180" : "")} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all",
                  activeNav === item.id
                    ? "bg-primary/12 border border-primary/20 text-primary"
                    : "text-white/35 hover:text-white/65 hover:bg-white/4 border border-transparent"
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/6 space-y-1 shrink-0">
          <button onClick={() => navigate("/chat")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-white/25 hover:text-white/55 hover:bg-white/4 transition-all">
            <Zap className="w-4 h-4 shrink-0 text-primary/50" />
            {sidebarOpen && <span>العودة للدردشة</span>}
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-red-400/50 hover:text-red-400 hover:bg-red-500/8 transition-all">
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-white/6 bg-[hsl(228_22%_4%)] shrink-0">
          <div>
            <h1 className="text-sm font-black text-white">
              {NAV.find(n => n.id === activeNav)?.label}
            </h1>
            <p className="text-[10px] text-white/30 mt-0.5">Zanix AI · لوحة الإدارة</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { if (activeNav === "dashboard") loadDashboard(); else if (activeNav === "users") loadUsers(); else if (activeNav === "tasks") loadTasks(); else if (activeNav === "system") loadSystem(); }}
              className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/6 transition-all border border-transparent", refreshing && "animate-spin")}>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/3 border border-white/6">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400/70">مباشر</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ════ Dashboard ════ */}
          {activeNav === "dashboard" && stats && (
            <div className="space-y-6">
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="إجمالي المستخدمين" value={stats.totalUsers}
                  sub={`${stats.adminUsers} مدير · ${stats.proUsers} Pro`}
                  color="border-violet-500/15 bg-violet-500/5" icon={Users} />
                <StatCard label="إجمالي المهام" value={stats.totalTasks}
                  sub={`${stats.runningTasks} تشغيل الآن`}
                  color="border-blue-500/15 bg-blue-500/5" icon={Activity} />
                <StatCard label="معدل النجاح" value={`${stats.successRate}%`}
                  sub={`${stats.completedTasks} مكتملة · ${stats.failedTasks} فاشلة`}
                  color="border-emerald-500/15 bg-emerald-500/5" icon={TrendingUp} />
                <StatCard label="الجلسات" value={stats.totalSessions}
                  sub="جلسات محادثة"
                  color="border-cyan-500/15 bg-cyan-500/5" icon={Database} />
              </div>

              {/* Recent activity */}
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Recent tasks */}
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <p className="text-xs font-bold text-white/70">آخر المهام</p>
                    <button onClick={() => setActiveNav("tasks")} className="text-[10px] text-primary/60 hover:text-primary transition-colors">عرض الكل</button>
                  </div>
                  <div className="divide-y divide-white/4">
                    {recentTasks.length === 0 && (
                      <p className="text-xs text-white/25 text-center py-6">لا توجد مهام بعد</p>
                    )}
                    {recentTasks.map(t => (
                      <div key={t.taskId} className="flex items-center gap-3 px-4 py-3">
                        <StatusDot status={t.status} />
                        <p className="text-xs text-white/60 flex-1 truncate">{t.goal}</p>
                        <span className="text-[10px] text-white/25 shrink-0">{timeAgo(t.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent users */}
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <p className="text-xs font-bold text-white/70">أحدث المستخدمين</p>
                    <button onClick={() => setActiveNav("users")} className="text-[10px] text-primary/60 hover:text-primary transition-colors">عرض الكل</button>
                  </div>
                  <div className="divide-y divide-white/4">
                    {recentUsers.length === 0 && (
                      <p className="text-xs text-white/25 text-center py-6">لا يوجد مستخدمون بعد</p>
                    )}
                    {recentUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {u.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white/70 truncate">{u.name}</p>
                          <p className="text-[10px] text-white/30 truncate">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge plan={u.plan} />
                          {u.role === "admin" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/12 text-amber-400 border border-amber-500/20">
                              مدير
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ Users ════ */}
          {activeNav === "users" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                  <input
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="بحث بالاسم أو البريد..."
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl pr-9 pl-3.5 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-all"
                  />
                </div>
                <span className="text-xs text-white/30">{filteredUsers.length} مستخدم</span>
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/6">
                        <th className="text-right text-[10px] font-bold text-white/30 uppercase tracking-wider px-4 py-3">المستخدم</th>
                        <th className="text-right text-[10px] font-bold text-white/30 uppercase tracking-wider px-4 py-3">الخطة</th>
                        <th className="text-right text-[10px] font-bold text-white/30 uppercase tracking-wider px-4 py-3">الدور</th>
                        <th className="text-right text-[10px] font-bold text-white/30 uppercase tracking-wider px-4 py-3">انضم</th>
                        <th className="text-right text-[10px] font-bold text-white/30 uppercase tracking-wider px-4 py-3">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                {u.name[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white/75 truncate max-w-[140px]">{u.name}</p>
                                <p className="text-[10px] text-white/30 truncate max-w-[140px]">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><Badge plan={u.plan} /></td>
                          <td className="px-4 py-3">
                            {u.role === "admin" ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400 border border-amber-500/20 w-fit">
                                <Crown className="w-2.5 h-2.5" /> مدير
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/4 text-white/35 border border-white/8">
                                مستخدم
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] text-white/30">{timeAgo(u.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingUser(u)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-primary hover:bg-primary/8 transition-all">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(u.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-500/8 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-xs text-white/25">لا يوجد مستخدمون</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit Modal */}
              <AnimatePresence>
                {editingUser && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={e => { if (e.target === e.currentTarget) setEditingUser(null); }}>
                    <motion.div initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 10 }}
                      className="w-full max-w-sm bg-[hsl(228_22%_6%)] border border-white/10 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/20 flex items-center justify-center">
                          <Edit3 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">تعديل المستخدم</p>
                          <p className="text-[11px] text-white/35">{editingUser.email}</p>
                        </div>
                      </div>

                      <EditUserForm user={editingUser} onSave={(updates) => handleUpdateUser(editingUser.id, updates)} onCancel={() => setEditingUser(null)} loading={actionLoading} />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Delete Confirm */}
              <AnimatePresence>
                {confirmDelete !== null && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
                    <motion.div initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}
                      className="w-full max-w-xs bg-[hsl(228_22%_6%)] border border-red-500/20 rounded-2xl p-5 space-y-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                      </div>
                      <p className="text-sm font-bold text-white">تأكيد الحذف</p>
                      <p className="text-xs text-white/40">هذا الإجراء لا يمكن التراجع عنه</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDelete(null)}
                          className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/50 hover:bg-white/4 transition-all">
                          إلغاء
                        </button>
                        <button onClick={() => handleDeleteUser(confirmDelete)} disabled={actionLoading}
                          className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/22 transition-all disabled:opacity-50">
                          حذف
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ════ Tasks ════ */}
          {activeNav === "tasks" && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {["all", "running", "completed", "failed", "pending"].map(f => (
                  <button key={f} onClick={() => setTaskFilter(f)}
                    className={cn("px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all",
                      taskFilter === f ? "bg-primary/15 border-primary/25 text-primary" : "bg-white/4 border-white/8 text-white/40 hover:border-white/15")}>
                    {f === "all" ? "الكل" : f === "running" ? "يعمل" : f === "completed" ? "مكتمل" : f === "failed" ? "فاشل" : "معلق"}
                    <span className="mr-1.5 text-[9px] opacity-60">
                      {f === "all" ? tasks.length : tasks.filter(t => t.status === f).length}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                <div className="divide-y divide-white/4">
                  {filteredTasks.length === 0 && (
                    <p className="text-xs text-white/25 text-center py-8">لا توجد مهام</p>
                  )}
                  {filteredTasks.map(t => (
                    <div key={t.taskId} className="flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                      <StatusDot status={t.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/70 leading-relaxed line-clamp-2">{t.goal}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-white/25 font-mono">{t.taskId.slice(0, 12)}…</span>
                          <span className="text-[10px] text-white/25">{timeAgo(t.createdAt)}</span>
                        </div>
                      </div>
                      <span className={cn("shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        t.status === "completed" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                        t.status === "running" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
                        t.status === "failed" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                        "text-white/30 bg-white/4 border-white/8")}>
                        {t.status === "completed" ? "مكتمل" : t.status === "running" ? "يعمل" : t.status === "failed" ? "فاشل" : "معلق"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════ Agent Config ════ */}
          {activeNav === "agent" && agentConfig && (
            <div className="space-y-5">
              {/* Model defaults */}
              <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/12 border border-primary/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-white/80">إعدادات النماذج</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {agentConfig.availableModels.map((m: any) => (
                    <div key={m.id} className={cn(
                      "p-3.5 rounded-xl border transition-all cursor-pointer",
                      agentConfig.defaultModel === m.id
                        ? "bg-primary/10 border-primary/25"
                        : "bg-white/3 border-white/6 hover:border-white/12"
                    )}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold text-white/80">{m.label}</p>
                        {agentConfig.defaultModel === m.id && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">افتراضي</span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/35 leading-relaxed">{m.description}</p>
                      <p className="text-[10px] font-mono text-white/20 mt-1">{m.id}</p>
                    </div>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  {[
                    { label: "الحد الأقصى للتكرارات", value: agentConfig.maxIterations },
                    { label: "الحد الأقصى للتوكن", value: agentConfig.maxTokens.toLocaleString() },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/6">
                      <span className="text-xs text-white/45">{item.label}</span>
                      <span className="text-xs font-bold text-white/70">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/12 border border-cyan-500/20 flex items-center justify-center">
                    <Settings2 className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-sm font-bold text-white/80">الأدوات المُفعَّلة</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {Object.entries(agentConfig.tools).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-white/3 border border-white/6">
                      <span className="text-[11px] text-white/55 font-mono">{key}</span>
                      <span className={cn("w-5 h-5 rounded-md flex items-center justify-center",
                        enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-white/4 text-white/20")}>
                        {enabled ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════ System ════ */}
          {activeNav === "system" && systemInfo && (
            <div className="space-y-5">
              {/* Server info */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl border border-white/6 bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-2 text-white/50">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-semibold">وقت التشغيل</span>
                  </div>
                  <p className="text-xl font-black text-white">{formatUptime(systemInfo.uptime)}</p>
                </div>
                <div className="p-4 rounded-2xl border border-white/6 bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-2 text-white/50">
                    <MemoryStick className="w-4 h-4" />
                    <span className="text-xs font-semibold">الذاكرة</span>
                  </div>
                  <p className="text-xl font-black text-white">{systemInfo.memory.heapUsed} MB</p>
                  <p className="text-[10px] text-white/30">من {systemInfo.memory.heapTotal} MB</p>
                </div>
                <div className="p-4 rounded-2xl border border-white/6 bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-2 text-white/50">
                    <Terminal className="w-4 h-4" />
                    <span className="text-xs font-semibold">Node.js</span>
                  </div>
                  <p className="text-xl font-black text-white font-mono">{systemInfo.nodeVersion}</p>
                  <p className="text-[10px] text-white/30">{systemInfo.platform}</p>
                </div>
              </div>

              {/* Task counts */}
              {systemInfo.tasksByStatus && (
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                  <p className="text-xs font-bold text-white/60 mb-3">توزيع المهام</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "معلق", count: systemInfo.tasksByStatus.pending, color: "text-amber-400" },
                      { label: "يعمل", count: systemInfo.tasksByStatus.running, color: "text-blue-400" },
                      { label: "مكتمل", count: systemInfo.tasksByStatus.completed, color: "text-emerald-400" },
                      { label: "فاشل", count: systemInfo.tasksByStatus.failed, color: "text-red-400" },
                    ].map((item) => (
                      <div key={item.label} className="text-center p-3 rounded-xl bg-white/3 border border-white/6">
                        <p className={cn("text-lg font-black", item.color)}>{item.count}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Env vars */}
              <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-white/40" />
                  <p className="text-xs font-bold text-white/60">متغيرات البيئة</p>
                  <span className="text-[10px] text-white/25 mr-1">• القيم الحقيقية غير ظاهرة للأمان</span>
                </div>
                <div className="space-y-2">
                  {systemInfo.envStatus.map(env => (
                    <div key={env.key} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/6">
                      <div className="flex items-center gap-2.5">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", env.set ? "bg-emerald-400" : "bg-white/20")} />
                        <span className="text-[11px] font-mono text-white/55">{env.key}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {env.set && env.preview && (
                          <span className="text-[10px] font-mono text-white/25">{env.preview}</span>
                        )}
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                          env.set ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-white/25 bg-white/4 border-white/8")}>
                          {env.set ? "مُعيَّن" : "غير مُعيَّن"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Edit User Form ────────────────────────────────────────────────
function EditUserForm({ user, onSave, onCancel, loading }: {
  user: AdminUser;
  onSave: (updates: Partial<AdminUser>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [role, setRole] = useState<"user" | "admin">(user.role);
  const [plan, setPlan] = useState<"free" | "pro" | "enterprise">(user.plan);
  const [name, setName] = useState(user.name);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">الاسم</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-primary/40 transition-all" />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">الدور</label>
        <div className="flex gap-2">
          {(["user", "admin"] as const).map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={cn("flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                role === r ? "bg-primary/15 border-primary/25 text-primary" : "bg-white/4 border-white/8 text-white/40 hover:border-white/16")}>
              {r === "admin" ? "مدير" : "مستخدم"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">الخطة</label>
        <div className="flex gap-2">
          {(["free", "pro", "enterprise"] as const).map(p => (
            <button key={p} onClick={() => setPlan(p)}
              className={cn("flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                plan === p ? "bg-primary/15 border-primary/25 text-primary" : "bg-white/4 border-white/8 text-white/40 hover:border-white/16")}>
              {p === "free" ? "مجاني" : p === "pro" ? "Pro" : "Enterprise"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/45 hover:bg-white/4 transition-all">
          إلغاء
        </button>
        <button onClick={() => onSave({ role, plan, name })} disabled={loading}
          className="flex-1 py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-bold hover:bg-primary/22 transition-all disabled:opacity-50">
          {loading ? "..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}
