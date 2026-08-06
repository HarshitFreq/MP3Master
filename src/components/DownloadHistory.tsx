'use client';

import React from 'react';
import { DownloadHistoryItem } from '@/lib/types';
import { History, Trash2, ArrowUpRight } from 'lucide-react';

interface DownloadHistoryProps {
  history: DownloadHistoryItem[];
  onClearHistory: () => void;
  onSelectHistoryItem: (url: string) => void;
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  history,
  onClearHistory,
  onSelectHistoryItem,
}) => {
  if (!history || history.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 pt-6 border-t border-gray-200/60 dark:border-white/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          Recent Downloads ({history.length})
        </span>

        <button
          onClick={onClearHistory}
          className="text-[11px] text-gray-400 hover:text-rose-500 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      <div className="space-y-2">
        {history.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectHistoryItem(item.url)}
            className="cursor-pointer p-2.5 rounded-xl bg-white dark:bg-[#0f1422] border border-gray-200/60 dark:border-white/5 hover:border-rose-500/30 transition-all flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-rose-500">
                  {item.title}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {item.uploader} • {item.quality}kbps
                </p>
              </div>
            </div>

            <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-rose-500 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};
