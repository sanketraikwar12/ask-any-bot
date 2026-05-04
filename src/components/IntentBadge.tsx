import { motion } from "framer-motion";

const intentColors: Record<string, string> = {
  // College
  admissions: "text-intent-college bg-intent-college/10 border-intent-college/30",
  courses: "text-intent-college bg-intent-college/10 border-intent-college/30",
  scholarships: "text-intent-college bg-intent-college/10 border-intent-college/30",
  campus_life: "text-intent-college bg-intent-college/10 border-intent-college/30",
  general_college: "text-intent-college bg-intent-college/10 border-intent-college/30",
  // Health
  nutrition: "text-intent-health bg-intent-health/10 border-intent-health/30",
  exercise: "text-intent-health bg-intent-health/10 border-intent-health/30",
  mental_health: "text-intent-health bg-intent-health/10 border-intent-health/30",
  symptoms: "text-intent-health bg-intent-health/10 border-intent-health/30",
  general_health: "text-intent-health bg-intent-health/10 border-intent-health/30",
  // Crops
  pest_management: "text-intent-crops bg-intent-crops/10 border-intent-crops/30",
  soil_health: "text-intent-crops bg-intent-crops/10 border-intent-crops/30",
  irrigation: "text-intent-crops bg-intent-crops/10 border-intent-crops/30",
  crop_selection: "text-intent-crops bg-intent-crops/10 border-intent-crops/30",
  general_agriculture: "text-intent-crops bg-intent-crops/10 border-intent-crops/30",
  // General
  question: "text-intent-general bg-intent-general/10 border-intent-general/30",
  explanation: "text-intent-general bg-intent-general/10 border-intent-general/30",
  recommendation: "text-intent-general bg-intent-general/10 border-intent-general/30",
  creative: "text-intent-general bg-intent-general/10 border-intent-general/30",
  general: "text-intent-general bg-intent-general/10 border-intent-general/30",
};

export function IntentBadge({ intent }: { intent: string }) {
  const colors = intentColors[intent] || intentColors.general;
  const label = intent.replace(/_/g, " ");

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-glow" />
      {label}
    </motion.span>
  );
}
