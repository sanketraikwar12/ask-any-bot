import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Heart, Sprout, Sparkles } from "lucide-react";
import type { Domain } from "@/lib/chat";

const domains: { id: Domain; label: string; icon: ReactNode; color: string }[] = [
  { id: "college", label: "College", icon: <GraduationCap className="h-4 w-4" />, color: "text-intent-college" },
  { id: "health", label: "Health", icon: <Heart className="h-4 w-4" />, color: "text-intent-health" },
  { id: "crops", label: "Agriculture", icon: <Sprout className="h-4 w-4" />, color: "text-intent-crops" },
  { id: "general", label: "General", icon: <Sparkles className="h-4 w-4" />, color: "text-intent-general" },
];

export function DomainSelector({
  selected,
  onChange,
}: {
  selected: Domain;
  onChange: (d: Domain) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chat domain">
      {domains.map((d) => (
        <motion.button
          key={d.id}
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(d.id)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            selected === d.id
              ? `${d.color} border-current bg-current/10`
              : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
          }`}
          aria-pressed={selected === d.id}
          aria-label={`Switch to ${d.label} mode`}
        >
          {d.icon}
          {d.label}
        </motion.button>
      ))}
    </div>
  );
}
