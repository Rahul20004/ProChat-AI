import React, { useEffect } from 'react';
import { IoCheckmarkCircle, IoWarning, IoAlertCircle, IoClose } from 'react-icons/io5';

const Toast = ({ message, type = 'success', onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const typeConfig = {
    success: {
      bg: 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300',
      icon: <IoCheckmarkCircle className="h-5 w-5 text-emerald-400" />,
    },
    error: {
      bg: 'bg-rose-950/80 border-rose-500/30 text-rose-300',
      icon: <IoAlertCircle className="h-5 w-5 text-rose-400" />,
    },
    warning: {
      bg: 'bg-amber-950/80 border-amber-500/30 text-amber-300',
      icon: <IoWarning className="h-5 w-5 text-amber-400" />,
    },
  };

  const config = typeConfig[type] || typeConfig.success;

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-md transition-all duration-300 ${config.bg}`}>
      <div>{config.icon}</div>
      <div className="text-sm font-medium pr-2">{message}</div>
      <button
        onClick={onClose}
        className="ml-auto rounded-full p-1 hover:bg-white/10 transition-colors"
      >
        <IoClose className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;
