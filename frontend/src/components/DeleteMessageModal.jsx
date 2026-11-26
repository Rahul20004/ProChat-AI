import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, User, Users, X, Loader2 } from 'lucide-react';

/**
 * Delete Message Confirmation Modal
 * Matches ProChat AI specifications & dark theme styling:
 * - Header with red trash icon and title
 * - Selected message preview box
 * - Selectable deletion choices: "Delete for me" vs "Delete for everyone"
 * - Action buttons with loading state & prevention of duplicate requests
 */
const DeleteMessageModal = ({
  isOpen,
  onClose,
  message,
  currentUser,
  onConfirmDelete,
}) => {
  const [selectedOption, setSelectedOption] = useState(null); // 'me' | 'everyone'
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !message) return null;

  // Determine if current user is the author of this message
  const isSender =
    (message.sender?._id || message.sender)?.toString() === currentUser?._id?.toString();

  const handleSelect = (option) => {
    if (isDeleting) return;
    // If not sender, "everyone" is not permitted
    if (option === 'everyone' && !isSender) return;
    setSelectedOption(option);
  };

  const handleConfirm = async () => {
    if (!selectedOption || isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirmDelete(selectedOption);
      handleClose();
    } catch (err) {
      console.error('Delete execution error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setSelectedOption(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        {/* Backdrop click */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          onClick={handleClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-md rounded-2xl bg-[#182229] border border-[#222e35] shadow-2xl text-[#e9edef] overflow-hidden z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[#222e35]">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Delete Message
                </h3>
                <p className="text-xs text-[#8696a0]">
                  This action will affect your message.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isDeleting}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#202c33] transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Selected Message Preview */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-[#8696a0] uppercase tracking-wider block">
                Selected message preview
              </span>
              <div className="p-3 rounded-xl bg-[#111b21] border border-[#222e35] text-xs text-[#cfd9df] italic leading-relaxed break-words max-h-24 overflow-y-auto">
                &ldquo;{message.text}&rdquo;
              </div>
            </div>

            {/* Selection Prompt */}
            <div>
              <p className="text-xs font-medium text-white mb-2.5">
                How would you like to delete this message?
              </p>

              {/* Options Grid */}
              <div className="space-y-2">
                {/* Option 1: Delete for me */}
                <div
                  onClick={() => handleSelect('me')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                    selectedOption === 'me'
                      ? 'border-red-500/60 bg-red-500/10 ring-1 ring-red-500/30'
                      : 'border-[#222e35] bg-[#111b21] hover:border-[#374248] hover:bg-[#1a252c]'
                  } ${isDeleting ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                      selectedOption === 'me'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-[#202c33] text-[#8696a0]'
                    }`}
                  >
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Delete for me</h4>
                      <span
                        className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                          selectedOption === 'me'
                            ? 'border-red-500 bg-red-500'
                            : 'border-[#374248]'
                        }`}
                      >
                        {selectedOption === 'me' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8696a0] mt-0.5">
                      Remove it from your chat only.
                    </p>
                  </div>
                </div>

                {/* Option 2: Delete for everyone */}
                <div
                  onClick={() => handleSelect('everyone')}
                  className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 select-none ${
                    !isSender
                      ? 'opacity-40 border-[#222e35] bg-[#111b21] cursor-not-allowed'
                      : selectedOption === 'everyone'
                      ? 'border-red-500/60 bg-red-500/10 ring-1 ring-red-500/30 cursor-pointer'
                      : 'border-[#222e35] bg-[#111b21] hover:border-[#374248] hover:bg-[#1a252c] cursor-pointer'
                  } ${isDeleting ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                      selectedOption === 'everyone'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-[#202c33] text-[#8696a0]'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">
                        Delete for everyone
                      </h4>
                      {isSender && (
                        <span
                          className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                            selectedOption === 'everyone'
                              ? 'border-red-500 bg-red-500'
                              : 'border-[#374248]'
                          }`}
                        >
                          {selectedOption === 'everyone' && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8696a0] mt-0.5">
                      {isSender
                        ? "Remove it from everyone's chat, if permitted."
                        : 'Only the sender can delete this message for everyone.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[#111b21] border-t border-[#222e35]">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#cfd9df] hover:text-white bg-[#202c33] hover:bg-[#2a3942] border border-[#222e35] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedOption || isDeleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-red-950/40"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Message</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DeleteMessageModal;
