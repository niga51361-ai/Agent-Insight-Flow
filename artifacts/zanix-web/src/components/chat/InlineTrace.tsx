import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, ChevronDown, Lightbulb, Wrench, Eye, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyBtn } from "./CodeBlock";
import { getStepMeta } from "./types";
import type { TraceStep } from "./types";

// ─── Duration helpers ─────────────────────────────────────────────
function LiveDuration({ startTs }: { startTs?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTs) return;
    const id = setInterval(() => setElapsed(Date.now() - startTs), 100);
    return () => clearInterval(id);
  }, [startTs]);
  return (
    <span className="font-mono text-[9px] text-white/30">
      {(elapsed / 1000).toFixed(1)}s
    </span>
  );
}

function StaticDuration({ ms }: { ms?: number }) {
  if (!ms) return null;
  return (
    <span className="font-mono text-[9px] text-white/25">
      {ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}
    </span>
  );
}

// ─── Inline Step Row ──────────────────────────────────────────────
function InlineStepRow({ step, idx }: { step: TraceStep; idx: number }) {
  const [open, setOpen] = useState(false);
  const meta = getStepMeta(step.type);
  const Icon = meta.icon;
  const isRun = step.status === "running";
  const isDone = step.status === "completed";
  const isFail = step.status === "failed";
  const hasDetail = !!(step.thought || step.toolInput || step.observation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: idx * 0.035 }}
      className="relative"
    >
      <button
        onClick={() => hasDetail && setOpen((p) => !p)}
        disabled={!hasDetail}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-right group/step",
          isRun
            ? cn(meta.bg, "border", meta.border, "shadow-sm")
            : isDone
            ? "hover:bg-white/[0.025]"
            : isFail
            ? "hover:bg-red-500/5"
            : "hover:bg-white/[0.02]",
          !hasDetail && "cursor-default"
        )}
      >
        <div
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all",
            isDone
              ? "bg-emerald-500/12 border-emerald-500/30"
              : isFail
              ? "bg-red-500/12 border-red-500/30"
              : isRun
              ? cn(meta.bg, meta.border)
              : "bg-white/[0.04] border-white/10"
          )}
        >
          {isDone ? (
            <Check className="w-2.5 h-2.5 text-emerald-400" />
          ) : isFail ? (
            <X className="w-2.5 h-2.5 text-red-400" />
          ) : isRun ? (
            <motion.div
              className={cn("w-2 h-2 rounded-full", meta.dot)}
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 0.7, repeat: 9999 }}
            />
          ) : (
            <Icon className={cn("w-2.5 h-2.5", meta.text)} />
          )}
        </div>

        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "text-[11px] font-semibold",
              isRun
                ? meta.text
                : isDone
                ? "text-white/55"
                : isFail
                ? "text-red-400/70"
                : "text-white/30"
            )}
          >
            {meta.label}
          </span>
          {step.toolName && (
            <span className="hidden sm:block text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/6 text-white/25 truncate max-w-[130px]">
              {step.toolName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isRun ? (
            <LiveDuration startTs={step.timestamp} />
          ) : (
            <StaticDuration ms={step.duration} />
          )}
          {hasDetail && (
            <ChevronDown
              className={cn(
                "w-3 h-3 text-white/15 transition-transform duration-200 opacity-0 group-hover/step:opacity-100",
                open && "rotate-180"
              )}
            />
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden mx-3 mb-1 mt-0.5"
          >
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] overflow-hidden divide-y divide-white/[0.05]">
              {step.thought && (
                <div className="px-3 py-2.5">
                  <p className="text-[9px] text-amber-400/50 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Lightbulb className="w-2.5 h-2.5" /> تفكير
                  </p>
                  <p className="text-[11px] text-white/45 leading-relaxed italic">
                    {step.thought}
                  </p>
                </div>
              )}
              {step.toolInput && Object.keys(step.toolInput).length > 0 && (
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] text-violet-400/50 font-black uppercase tracking-widest flex items-center gap-1">
                      <Wrench className="w-2.5 h-2.5" /> المدخلات
                    </p>
                    <CopyBtn text={JSON.stringify(step.toolInput, null, 2)} size="xs" />
                  </div>
                  <pre className="text-[10px] font-mono text-white/38 overflow-x-auto leading-relaxed max-h-24 whitespace-pre-wrap">
                    {JSON.stringify(step.toolInput, null, 2)}
                  </pre>
                </div>
              )}
              {step.observation && (
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] text-cyan-400/50 font-black uppercase tracking-widest flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5" /> النتيجة
                    </p>
                    <CopyBtn text={step.observation} size="xs" />
                  </div>
                  <p className="text-[11px] text-white/42 leading-relaxed overflow-y-auto max-h-28 whitespace-pre-wrap">
                    {step.observation.slice(0, 800)}
                    {step.observation.length > 800 ? "…" : ""}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Inline Trace Container ───────────────────────────────────────
export function InlineTrace({ steps, isLive }: { steps: TraceStep[]; isLive: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const runningStep = steps.find((s) => s.status === "running");
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const failedCount = steps.filter((s) => s.status === "failed").length;
  const totalDuration = steps.reduce((acc, s) => acc + (s.duration ?? 0), 0);
  const [liveMs, setLiveMs] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!isLive) return;
    startRef.current = Date.now();
    const id = setInterval(() => setLiveMs(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [isLive]);

  useEffect(() => {
    if (!isLive && steps.length > 0) setExpanded(false);
  }, [isLive, steps.length]);

  if (steps.length === 0 && !isLive) return null;

  const displayMs = isLive ? liveMs : totalDuration;

  return (
    <div
      className={cn(
        "mb-3 rounded-2xl border overflow-hidden transition-all",
        isLive
          ? "border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent shadow-[0_0_20px_hsl(260_84%_63%/0.06)]"
          : "border-white/[0.07] bg-white/[0.016]"
      )}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-all hover:bg-white/[0.02] text-right"
      >
        <div
          className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all",
            isLive
              ? "bg-primary/15 border-primary/28 shadow-[0_0_10px_hsl(260_84%_63%/0.2)]"
              : failedCount > 0
              ? "bg-red-500/12 border-red-500/25"
              : "bg-emerald-500/12 border-emerald-500/25"
          )}
        >
          {isLive ? (
            <motion.div
              className="w-3.5 h-3.5 border-[1.5px] border-primary/25 border-t-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.75, repeat: 9999, ease: "linear" }}
            />
          ) : failedCount > 0 ? (
            <AlertCircle className="w-3 h-3 text-red-400" />
          ) : (
            <Check className="w-3 h-3 text-emerald-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isLive && runningStep ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-primary/85">
                {getStepMeta(runningStep.type).label}
              </span>
              {runningStep.toolName && (
                <span className="hidden sm:block text-[10px] font-mono text-white/22 truncate max-w-[100px]">
                  {runningStep.toolName}
                </span>
              )}
              <div className="flex gap-0.5">
                {[0, 1, 2].map((j) => (
                  <motion.div
                    key={j}
                    className="w-1 h-1 rounded-full bg-primary/45"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 0.85, delay: j * 0.18, repeat: 9999 }}
                  />
                ))}
              </div>
            </div>
          ) : isLive ? (
            <span className="text-[11px] font-semibold text-primary/55">يحلّل الطلب…</span>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-white/45">
                {steps.length} {steps.length === 1 ? "خطوة" : "خطوات"}
              </span>
              {completedCount > 0 && (
                <span className="text-[10px] font-bold text-emerald-400/60 flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" />
                  {completedCount}
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-[10px] font-bold text-red-400/60 flex items-center gap-0.5">
                  <X className="w-2.5 h-2.5" />
                  {failedCount}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {displayMs > 0 && (
            <span className="font-mono text-[9px] text-white/22 tabular-nums">
              {(displayMs / 1000).toFixed(isLive ? 1 : 2)}s
            </span>
          )}
          {!isLive && steps.length > 1 && (
            <div className="hidden sm:flex gap-[3px] items-center">
              {steps.slice(0, 10).map((s, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all",
                    s.status === "completed"
                      ? "w-1.5 h-1.5 bg-emerald-500/55"
                      : s.status === "failed"
                      ? "w-1.5 h-1.5 bg-red-500/55"
                      : s.status === "running"
                      ? "w-1.5 h-1.5 bg-primary/60"
                      : "w-1 h-1 bg-white/12"
                  )}
                />
              ))}
              {steps.length > 10 && (
                <span className="text-[8px] text-white/18 mr-0.5">+{steps.length - 10}</span>
              )}
            </div>
          )}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-white/22 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {isLive && (
        <div className="h-[2px] bg-white/[0.04] mx-3.5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 via-cyan-400/80 to-primary/70"
            initial={{ width: "0%", backgroundPosition: "0% 0%" }}
            animate={{ width: "82%", backgroundPosition: "200% 0%" }}
            transition={{
              width: { duration: 4, ease: [0.22, 1, 0.36, 1] },
              backgroundPosition: { duration: 1.8, repeat: 9999, ease: "linear" },
            }}
          />
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 pt-1.5 space-y-0.5">
              {steps.map((step, idx) => (
                <InlineStepRow key={step.stepIndex} step={step} idx={idx} />
              ))}
              {isLive && !runningStep && steps.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3">
                  {[0, 1, 2].map((j) => (
                    <motion.div
                      key={j}
                      className="w-1.5 h-1.5 rounded-full bg-primary/35"
                      animate={{ scale: [1, 1.45, 1] }}
                      transition={{ duration: 0.65, delay: j * 0.15, repeat: 9999 }}
                    />
                  ))}
                  <span className="text-[11px] text-white/22">تحليل الطلب…</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
