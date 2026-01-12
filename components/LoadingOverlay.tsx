
import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "Initializing geometry kernels...",
  "Calculating vertex projections...",
  "Synthesizing mesh topography...",
  "Rasterizing vector layers...",
  "Optimizing wireframe paths...",
  "Compiling technical schematics...",
  "Executing boolean operations...",
  "Rendering blueprint components...",
];

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message: customMessage }) => {
  const [message, setMessage] = useState(MESSAGES[0]);

  useEffect(() => {
    if (customMessage) return;
    const interval = setInterval(() => {
      setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, [customMessage]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full"></div>
        <div className="absolute inset-0 border-t-2 border-cyan-400 rounded-full animate-spin"></div>
        <div className="absolute inset-4 border-2 border-magenta-500/20 rounded-full"></div>
        <div className="absolute inset-4 border-b-2 border-magenta-400 rounded-full animate-spin [animation-duration:1.5s]"></div>
        <div className="absolute inset-8 border-2 border-yellow-500/20 rounded-full"></div>
        <div className="absolute inset-8 border-l-2 border-yellow-400 rounded-full animate-spin [animation-duration:2s]"></div>
      </div>
      <div className="text-center px-6">
        <p className="text-cyan-400 mono text-lg font-bold mb-2 animate-pulse uppercase tracking-tight">
          {customMessage || message}
        </p>
        <p className="text-gray-500 mono text-xs tracking-widest uppercase">System Processing Request...</p>
        {customMessage && (
          <div className="mt-6 flex justify-center">
            <div className="w-64 h-1 bg-gray-900 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 animate-[loading_120s_ease-in-out]"></div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes loading {
          0% { width: 0%; }
          100% { width: 95%; }
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;
