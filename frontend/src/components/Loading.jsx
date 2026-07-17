import React from 'react';

const Loading = ({ fullScreen = true }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-chatBg text-chatText ${
        fullScreen ? 'h-screen w-screen' : 'h-full w-full p-8'
      }`}
    >
      <div className="relative flex items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-chatBorder border-t-chatAccent"></div>
        <span className="absolute text-xs font-semibold text-chatAccent animate-pulse">Pro</span>
      </div>
      <p className="mt-4 text-sm font-medium tracking-wide text-chatMuted animate-pulse">
        Connecting to ProChat AI...
      </p>
    </div>
  );
};

export default Loading;
