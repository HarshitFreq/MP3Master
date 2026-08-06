'use client';

import React from 'react';
import { Music, Sun, Moon, AlertTriangle } from 'lucide-react';
import { BinaryHealth } from '@/lib/types';

interface HeaderProps {
  health: BinaryHealth | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  darkMode,
  onToggleDarkMode,
}) => {
  const isHealthy = health?.ytdlpInstalled && health?.ffmpegInstalled;

  return (
    <header className="w-full max-w-2xl mx-auto px-4 h-16 flex items-center justify-between border-b border-gray-200/50 dark:border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-rose-500 flex items-center justify-center text-white">
          <Music className="w-4 h-4" />
        </div>
        <span className="font-bold text-base tracking-tight text-gray-900 dark:text-white">
          MP3<span className="text-rose-500">Master</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {!isHealthy && health && (
          <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Missing yt-dlp/ffmpeg</span>
          </span>
        )}

        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>
    </header>
  );
};
