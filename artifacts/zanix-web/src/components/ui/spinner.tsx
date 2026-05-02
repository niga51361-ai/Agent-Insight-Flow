import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Spinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={cn(
        "rounded-full border-primary/30 border-t-primary",
        sizeMap[size],
        className
      )}
    />
  );
}

export function GlowingOrb({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      className={cn("w-3 h-3 rounded-full bg-accent shadow-[0_0_15px_rgba(6,182,212,0.8)]", className)}
    />
  );
}
