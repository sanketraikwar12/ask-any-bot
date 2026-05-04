import { Paperclip, X } from "lucide-react";
import { motion } from "framer-motion";

export const FileUploadButton: React.FC<{
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}> = ({ onFilesSelected, disabled = false }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      onFilesSelected(files);
      event.target.value = "";
    }
  };

  return (
    <motion.label
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      className="flex cursor-pointer items-center justify-center rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Upload file"
    >
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        accept="image/*,.pdf,.txt,.doc,.docx"
      />
      <Paperclip className="h-4 w-4" />
    </motion.label>
  );
};

export const FilePreview: React.FC<{
  files: File[];
  onRemove: (index: number) => void;
}> = ({ files, onRemove }) => {
  if (files.length === 0) return null;

  return (
    <div className="border-b border-border px-3 py-2">
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => (
          <motion.div
            key={`${file.name}-${index}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2 rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground"
          >
            <span className="truncate max-w-32">{file.name}</span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onRemove(index)}
              className="ml-1 rounded hover:bg-destructive/20"
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3 w-3" />
            </motion.button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
