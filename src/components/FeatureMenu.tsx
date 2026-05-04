import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useState } from "react";

interface Feature {
  id: string;
  label: string;
  icon: string;
}

const features: Feature[] = [
  { id: "photos", label: "Photos", icon: "📷" },
  { id: "image", label: "Generate", icon: "🎨" },
  { id: "thinking", label: "Think", icon: "🧠" },
  { id: "research", label: "Research", icon: "📚" },
];

export const FeatureMenu: React.FC<{
  onFeatureSelect: (featureId: string) => void;
  disabled?: boolean;
}> = ({ onFeatureSelect, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Feature menu"
      >
        <Sparkles className="h-4 w-4" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            className="absolute right-0 bottom-full mb-2 rounded-xl border border-border bg-card p-2 shadow-lg z-50"
          >
            {features.map((feature) => (
              <motion.button
                key={feature.id}
                whileHover={{ scale: 1.05, x: 4 }}
                onClick={() => {
                  onFeatureSelect(feature.id);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                <span>{feature.icon}</span>
                <span>{feature.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
