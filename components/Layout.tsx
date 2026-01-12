
import React from 'react';
import { AppMode } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeMode, onModeChange }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-gray-200">
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-cyan-900/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-cyan-500 rounded-sm flex items-center justify-center transform rotate-45 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <div className="w-4 h-4 border border-black transform -rotate-45"></div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter mono text-cyan-400">MESH_MAKER.V1</h1>
            <p className="text-[10px] text-magenta-500 uppercase tracking-widest mono">Schematic Core // CP: working_mesh_maker</p>
          </div>
        </div>

        <nav className="flex space-x-1 bg-black/40 p-1 rounded-lg border border-gray-800">
          {(Object.values(AppMode) as AppMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 uppercase tracking-wider mono ${
                activeMode === mode
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {children}
      </main>

      <footer className="py-6 border-t border-gray-900 text-center text-xs text-gray-600 mono">
        &copy; {new Date().getFullYear()} WORKING_MESH_MAKER // SYSTEM_STABLE_CHECKPOINT
      </footer>
    </div>
  );
};

export default Layout;
