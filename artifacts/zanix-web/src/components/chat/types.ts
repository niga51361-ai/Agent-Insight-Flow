export interface TraceStep {
  stepIndex: number;
  type: string;
  thought?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  observation?: string;
  status: "pending" | "running" | "completed" | "failed";
  timestamp?: number;
  duration?: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: "image" | "file";
  dataUrl: string;
  mimeType: string;
  size: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  steps?: TraceStep[];
  isStreaming?: boolean;
  taskId?: string;
  tokensUsed?: number;
  subResults?: unknown[];
  error?: string;
  createdAt: Date;
}

export const MODELS = [
  { id: "gpt-5.2",    label: "Zanix Max",   badge: "الأقوى",  dot: "bg-violet-400", color: "text-violet-400" },
  { id: "gpt-5-nano", label: "Zanix Flash", badge: "الأسرع",  dot: "bg-cyan-400",   color: "text-cyan-400" },
  { id: "o4-mini",    label: "Zanix Think", badge: "استنتاج", dot: "bg-amber-400",  color: "text-amber-400" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

import {
  Lightbulb, Search, Globe, Code2, Terminal, FileText, Eye,
  BarChart3, Check, Wrench, Brain, Image as ImageIcon,
} from "lucide-react";

export const STEP_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  label: string; text: string; bg: string; border: string; glow: string; dot: string;
}> = {
  think:      { icon: Lightbulb, label: "تفكير",        text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   glow: "shadow-amber-500/20",  dot: "bg-amber-400" },
  search:     { icon: Search,    label: "بحث",           text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    glow: "shadow-blue-500/20",   dot: "bg-blue-400" },
  browse:     { icon: Globe,     label: "تصفح الويب",   text: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    glow: "shadow-cyan-500/20",   dot: "bg-cyan-400" },
  code:       { icon: Code2,     label: "كود",           text: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/25",  glow: "shadow-violet-500/20", dot: "bg-violet-400" },
  shell:      { icon: Terminal,  label: "طرفية",         text: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/25",  glow: "shadow-violet-500/20", dot: "bg-violet-400" },
  write_file: { icon: FileText,  label: "كتابة ملف",    text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/20",dot: "bg-emerald-400" },
  read_file:  { icon: Eye,       label: "قراءة ملف",    text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/20",dot: "bg-emerald-400" },
  data:       { icon: BarChart3, label: "تحليل بيانات", text: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/25",    glow: "shadow-pink-500/20",   dot: "bg-pink-400" },
  done:       { icon: Check,     label: "اكتمل",         text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/20",dot: "bg-emerald-400" },
  tool:       { icon: Wrench,    label: "أداة",          text: "text-primary/80",  bg: "bg-primary/8",      border: "border-primary/20",     glow: "shadow-primary/20",    dot: "bg-primary" },
  memory:     { icon: Brain,     label: "ذاكرة",         text: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/25",    glow: "shadow-rose-500/20",   dot: "bg-rose-400" },
  image:      { icon: ImageIcon, label: "صورة",          text: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/25",  glow: "shadow-orange-500/20", dot: "bg-orange-400" },
};

export function getStepMeta(type: string) {
  return (
    STEP_META[type] ?? {
      icon: Wrench,
      label: type,
      text: "text-white/45",
      bg: "bg-white/5",
      border: "border-white/10",
      glow: "",
      dot: "bg-white/30",
    }
  );
}
