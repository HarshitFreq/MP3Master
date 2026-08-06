'use client';

import React from 'react';
import { DownloadProgress } from '@/lib/types';
import { Download, RefreshCw, CheckCircle2, AlertCircle, Archive, Music } from 'lucide-react';

interface ProgressCardProps {
  progress: DownloadProgress;
  onReset: () => void;
  onDownloadFile: (fileId: string, fileName?: string) => void;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  progress,
  onReset,
  onDownloadFile,
}) => {
  const isError = progress.stage === 'error';
  const isCompleted = progress.stage === 'completed';
  const isBatch = progress.isBatch;

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 p-5 rounded-2xl bg-white dark:bg-[#0f1422] border border-gray-200 dark:border-white/10 shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isError ? (
            <AlertCircle className="w-4 h-4 text-rose-500" />
          ) : isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}

          <span className="text-xs font-bold text-gray-900 dark:text-white">
            {isError
              ? 'Batch Failed'
              : isCompleted
              ? 'Batch Complete'
              : isBatch && progress.currentTrackIndex && progress.totalTracks
              ? `Processing Track ${progress.currentTrackIndex}/${progress.totalTracks}`
              : progress.statusText || 'Converting...'}
          </span>
        </div>

        <span className="text-xs font-mono font-bold text-rose-500">
          {Math.round(progress.percent)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isError ? 'bg-rose-500' : isCompleted ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          style={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }}
        />
      </div>

      {/* Active Track Title */}
      {isBatch && progress.currentTrackTitle && !isCompleted && (
        <p className="text-xs text-gray-400 font-medium truncate mb-4">
          Current Track: <span className="text-gray-900 dark:text-white font-semibold">{progress.currentTrackTitle}</span>
        </p>
      )}

      {/* Completed Files & ZIP Download */}
      {isCompleted && (
        <div className="mb-4 space-y-2">
          {progress.zipFileId && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                <Archive className="w-4 h-4" />
                <span>Full Playlist Archive Ready (.zip)</span>
              </div>
              <button
                onClick={() => onDownloadFile(progress.zipFileId!, progress.zipFileName)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ZIP</span>
              </button>
            </div>
          )}

          {progress.completedFiles && progress.completedFiles.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
              {progress.completedFiles.map((file, idx) => (
                <div key={file.fileId || idx} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 truncate text-gray-700 dark:text-gray-300">
                    <Music className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">{file.title}</span>
                  </div>
                  <button
                    onClick={() => onDownloadFile(file.fileId, file.fileName)}
                    className="p-1 text-gray-400 hover:text-emerald-500 transition-colors shrink-0"
                    title="Download track"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Output */}
      {isError && progress.error && (
        <p className="text-xs text-rose-500 mb-3 font-mono">{progress.error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
        {isCompleted && progress.fileId && !isBatch && (
          <button
            onClick={() => onDownloadFile(progress.fileId!, progress.fileName)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save MP3</span>
          </button>
        )}

        <button
          onClick={onReset}
          className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-semibold transition-all flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isCompleted || isError ? 'Done' : 'Cancel'}</span>
        </button>
      </div>
    </div>
  );
};
