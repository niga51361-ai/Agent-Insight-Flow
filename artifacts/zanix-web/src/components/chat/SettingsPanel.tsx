import { useState } from "react";
import {
  Settings, User, Puzzle, Cpu, Sliders, Palette, Bell, Shield,
  Check, X, LogOut, Sparkles, ChevronLeft, Key, Database, Activity,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MODELS } from "./types";

const SETTINGS_TABS = [
  { id: "profile",       label: "الملف الشخصي",  icon: User },
  { id: "models",        label: "النماذج",        icon: Cpu },
  { id: "integrations",  label: "التكاملات",      icon: Puzzle },
  { id: "tools",         label: "الأدوات",        icon: Sliders },
  { id: "appearance",    label: "المظهر",         icon: Palette },
  { id: "notifications", label: "الإشعارات",     icon: Bell },
  { id: "security",      label: "الأمان",         icon: Shield },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

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

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-10 h-5.5 rounded-full border transition-all relative shrink-0",
        on ? "bg-primary/30 border-primary/40" : "bg-white/6 border-white/10"
      )}
    >
      <motion.div
        animate={{ x: on ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn("absolute top-0.5 w-4 h-4 rounded-full", on ? "bg-primary" : "bg-white/25")}
      />
    </button>
  );
}

export function SettingsPanel({
  user,
  onClose,
  onLogout,
}: {
  user: Record<string, string> | null;
  onClose: () => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [saved, setSaved] = useState(false);
  const [toolStates, setToolStates] = useState<Record<string, boolean>>(
    Object.fromEntries(TOOLS_LIST.map((t) => [t.name, t.active]))
  );

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full" dir="rtl">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Settings className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">الإعدادات</p>
          <p className="text-[10px] text-white/30">إدارة حسابك والنظام</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/6 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-44 shrink-0 border-l border-white/5 p-2 space-y-0.5 overflow-y-auto">
          {SETTINGS_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-right",
                  tab === t.id
                    ? "bg-primary/12 border border-primary/20 text-primary"
                    : "text-white/35 hover:text-white/65 hover:bg-white/4"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {tab === "profile" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">الملف الشخصي</h3>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/3 border border-white/6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {(user?.["name"] ?? user?.["email"] ?? "U")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.["name"] ?? "—"}</p>
                  <p className="text-xs text-white/40 truncate">{user?.["email"] ?? "—"}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
                    <Sparkles className="w-2.5 h-2.5" /> خطة مجانية
                  </span>
                </div>
              </div>
              {[
                { label: "الاسم الكامل",    value: user?.["name"]  ?? "", placeholder: "أدخل اسمك" },
                { label: "البريد الإلكتروني", value: user?.["email"] ?? "", placeholder: "email@example.com" },
              ].map((field, i) => (
                <div key={i} className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{field.label}</label>
                  <input
                    defaultValue={field.value}
                    placeholder={field.placeholder}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all"
                  />
                </div>
              ))}
              <button
                onClick={handleSave}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  saved
                    ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
                    : "bg-primary/15 border border-primary/25 text-primary hover:bg-primary/22"
                )}
              >
                {saved ? <><Check className="w-3.5 h-3.5" /> تم الحفظ</> : "حفظ التغييرات"}
              </button>
              <div className="pt-2 border-t border-white/6">
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/8 transition-all border border-transparent hover:border-red-500/15"
                >
                  <LogOut className="w-3.5 h-3.5" /> تسجيل الخروج
                </button>
              </div>
            </div>
          )}

          {tab === "models" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">نماذج الذكاء الاصطناعي</h3>
              <p className="text-xs text-white/35 leading-relaxed">اختر النموذج المناسب لمهامك. كل نموذج له مزايا مختلفة.</p>
              {MODELS.map((m) => (
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
                    <Toggle
                      on={toolStates[tool.name] ?? false}
                      onToggle={() =>
                        setToolStates((p) => ({ ...p, [tool.name]: !p[tool.name] }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">المظهر</h3>
              {[
                { label: "نظام الألوان",      options: ["داكن (افتراضي)", "فاتح", "تلقائي"] },
                { label: "حجم الخط",          options: ["صغير", "متوسط (افتراضي)", "كبير"] },
                { label: "كثافة الخلفية 3D", options: ["منخفضة", "متوسطة (افتراضي)", "عالية"] },
              ].map((pref, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{pref.label}</label>
                  <div className="flex gap-2 flex-wrap">
                    {pref.options.map((opt, j) => (
                      <button
                        key={j}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs border transition-all",
                          j === 1
                            ? "bg-primary/12 border-primary/25 text-primary"
                            : "bg-white/4 border-white/8 text-white/40 hover:border-white/16 hover:text-white/60"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white/80">الإشعارات</h3>
              {[
                { label: "إشعار عند اكتمال المهمة",    defaultOn: true },
                { label: "إشعارات الأخطاء والتنبيهات", defaultOn: true },
                { label: "نصائح وتحديثات المنتج",      defaultOn: false },
                { label: "إشعارات البريد الإلكتروني",  defaultOn: false },
              ].map((notif, i) => {
                const [on, setOn] = useState(notif.defaultOn);
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/5">
                    <p className="text-xs text-white/60">{notif.label}</p>
                    <Toggle on={on} onToggle={() => setOn((p) => !p)} />
                  </div>
                );
              })}
            </div>
          )}

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
                    <button
                      key={i}
                      className={cn(
                        "w-full flex items-center gap-3 p-3.5 rounded-2xl border text-right transition-all",
                        i === 2
                          ? "bg-red-500/5 border-red-500/12 hover:bg-red-500/10 hover:border-red-500/20"
                          : "bg-white/3 border-white/6 hover:border-white/12"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", i === 2 ? "bg-red-500/10" : "bg-white/5")}>
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
