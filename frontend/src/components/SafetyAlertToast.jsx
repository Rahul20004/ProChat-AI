import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Eye, X } from 'lucide-react';

const SafetyAlertToast = ({
  notification,
  onClose,
  onViewMessage,
}) => {
  useEffect(() => {
    if (!notification) return;
    // Auto-dismiss after 12 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 12000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const senderName = notification.sender?.username || 'Another user';
  const senderAvatar =
    notification.sender?.avatar ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${senderName}`;
  const isHigh = notification.severity === 'High';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed top-5 right-4 sm:right-6 z-50 max-w-sm w-full bg-[#182229] border border-rose-500/50 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-4 text-[#e9edef] backdrop-blur-md"
      >
        <div className="flex items-start gap-3">
          {/* Avatar with warning shield badge */}
          <div className="relative flex-shrink-0">
            <img
              src={senderAvatar}
              alt={senderName}
              className="w-10 h-10 rounded-full border border-rose-500/40 object-cover bg-[#111b21]"
            />
            <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-rose-600 text-white shadow">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Alert Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <h4 className="font-bold text-xs text-white truncate">
                Toxic Message Detected
              </h4>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-[#8696a0] hover:text-white hover:bg-[#222e35] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-[#cfd9df] leading-tight">
              A potentially harmful message was sent by <span className="font-semibold text-rose-300">{senderName}</span>.
            </p>

            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {notification.category}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  isHigh
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                {notification.severity}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  onViewMessage(notification);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all active:scale-95 shadow"
              >
                <Eye className="w-3.5 h-3.5" />
                View Message
              </button>
              <button
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-xl text-xs text-[#8696a0] hover:text-white hover:bg-[#222e35] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SafetyAlertToast;
