import { motion } from "framer-motion";
import { Send, Square } from "lucide-react";
import { FileUploadButton, FilePreview } from "./FileUpload";
import { FeatureMenu } from "./FeatureMenu";

interface ChatInputAreaProps {
  input: string;
  onInputChange: (text: string) => void;
  onSend: (text: string) => void;
  selectedFiles: File[];
  onFilesSelected: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  isLoading: boolean;
  isOnline: boolean;
  onFeatureSelect: (featureId: string) => void;
  maxLength: number;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  input,
  onInputChange,
  onSend,
  selectedFiles,
  onFilesSelected,
  onFileRemove,
  isLoading,
  isOnline,
  onFeatureSelect,
  maxLength,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend(input);
    }
  };

  return (
    <div className="space-y-3">
      {/* Main Input Container */}
      <div className="flex items-end gap-3">
        {/* File and Feature Buttons */}
        <div className="flex gap-2">
          <FileUploadButton
            onFilesSelected={(files) => {
              onFilesSelected([...selectedFiles, ...files]);
            }}
            disabled={!isOnline}
          />
          <FeatureMenu onFeatureSelect={onFeatureSelect} disabled={!isOnline} />
        </div>

        {/* Main Input Field */}
        <div className="flex-1 rounded-2xl border border-border bg-card transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
          {selectedFiles.length > 0 && (
            <FilePreview
              files={selectedFiles}
              onRemove={(index) => {
                onFileRemove(index);
              }}
            />
          )}
          <div className="flex items-end gap-2 px-4 py-3">
            <textarea
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              maxLength={maxLength}
              className="max-h-[120px] flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              aria-label="Message input"
            />

            {/* Send/Stop Button */}
            {isLoading ? (
              <motion.button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-all"
                disabled
                aria-label="Stop generating"
              >
                <Square className="h-4 w-4" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  onSend(input);
                }}
                disabled={!input.trim() || !isOnline}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
