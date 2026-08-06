'use client';

import React, { useState } from 'react';
import { AlertCircle, Copy, Check, Terminal, Info } from 'lucide-react';
import { BinaryHealth } from '@/lib/types';

interface BinaryHealthBannerProps {
  health: BinaryHealth | null;
}

export const BinaryHealthBanner: React.FC<BinaryHealthBannerProps> = ({ health }) => {
  const [copied, setCopied] = useState(false);

  if (!health) return null;

  const ytdlpOk = health.ytdlpInstalled;
  const ffmpegOk = health.ffmpegInstalled;

  if (ytdlpOk && ffmpegOk) return null;

  const cmd = health.recommendedCommand || 'brew install yt-dlp ffmpeg';

  const copyCommand = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 backdrop-blur-sm shadow-lg transition-all duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm sm:text-base">System Dependencies Required</h3>
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 mt-1">
              {!ytdlpOk && !ffmpegOk
                ? 'yt-dlp and FFmpeg are missing from your Mac system PATH.'
                : !ytdlpOk
                ? 'yt-dlp binary is missing on your machine.'
                : 'FFmpeg binary is missing on your machine (needed for MP3 audio conversion).'}
              {' Please install them using Homebrew:'}
            </p>
          </div>
        </div>

        {/* Command Box */}
        <div className="w-full sm:w-auto flex items-center justify-between gap-3 bg-black/60 dark:bg-black/80 px-3.5 py-2 rounded-xl border border-amber-500/40 text-amber-300 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{cmd}</span>
          </div>
          <button
            onClick={copyCommand}
            className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors"
            title="Copy command"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
