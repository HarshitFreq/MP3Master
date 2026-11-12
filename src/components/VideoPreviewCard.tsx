'use client';

import React, { useState } from 'react';
import { DownloadQuality, VideoMetadata } from '@/lib/types';
import { Download, Music, ListMusic, CheckSquare, Square } from 'lucide-react';

interface VideoPreviewCardProps {
  metadata: VideoMetadata;
  quality: DownloadQuality;
  setQuality: (quality: DownloadQuality) => void;
  onStartDownload: () => void;
  onStartBatchDownload?: (selectedItems: VideoMetadata[]) => void;
  isDownloading: boolean;
}

const QUALITIES: DownloadQuality[] = ['320', '256', '192', '128'];

export const VideoPreviewCard: React.FC<VideoPreviewCardProps> = ({
  metadata,
  quality,
  setQuality,
  onStartDownload,
  onStartBatchDownload,
  isDownloading,
}) => {
  const isPlaylist = metadata.isPlaylist && metadata.playlistItems && metadata.playlistItems.length > 0;
  const playlistItems = metadata.playlistItems || [];

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(playlistItems.map((_, idx) => idx))
  );

  const toggleSelectAll = () => {
    if (selectedIndices.size === playlistItems.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(playlistItems.map((_, idx) => idx)));
    }
  };

  const toggleSelectIndex = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const handleTriggerBatch = () => {
    const itemsToDownload = playlistItems.filter((_, idx) => selectedIndices.has(idx));
    if (itemsToDownload.length > 0 && onStartBatchDownload) {
      onStartBatchDownload(itemsToDownload);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 p-4 rounded-2xl bg-white dark:bg-[#0f1422] border border-gray-200 dark:border-white/10 shadow-xl">
      
      {/* Header Info */}
      <div className="flex items-center gap-4">
        <img
          src={metadata.thumbnail}
          alt={metadata.title}
          className="w-16 h-16 rounded-xl object-cover shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isPlaylist && <ListMusic className="w-4 h-4 text-rose-500 shrink-0" />}
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {metadata.title}
            </h3>
          </div>

          <p className="text-xs text-gray-400 truncate mt-0.5">
            {isPlaylist ? `${playlistItems.length} Tracks in Playlist` : `${metadata.uploader} • ${metadata.durationFormatted}`}
          </p>

          {/* Bitrate Selection */}
          <div className="flex items-center gap-1.5 mt-2">
            {QUALITIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  quality === q
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {q}k
              </button>
            ))}
          </div>
        </div>

        {/* Single Video Download Button */}
        {!isPlaylist && (
          <button
            onClick={onStartDownload}
            disabled={isDownloading}
            className="px-5 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20 transition-all shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download MP3</span>
          </button>
        )}
      </div>

      {/* Playlist Track Selection List */}
      {isPlaylist && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-bold text-rose-500 flex items-center gap-1.5 hover:underline"
            >
              {selectedIndices.size === playlistItems.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>
                {selectedIndices.size === playlistItems.length ? 'Deselect All' : 'Select All'} ({selectedIndices.size}/{playlistItems.length})
              </span>
            </button>

            <button
              onClick={handleTriggerBatch}
              disabled={isDownloading || selectedIndices.size === 0}
              className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Batch ({selectedIndices.size})</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {playlistItems.map((item, idx) => {
              const isChecked = selectedIndices.has(idx);
              return (
                <div
                  key={item.id || idx}
                  onClick={() => toggleSelectIndex(idx)}
                  className={`cursor-pointer p-2 rounded-xl text-xs flex items-center justify-between gap-3 transition-colors ${
                    isChecked
                      ? 'bg-rose-500/10 text-gray-900 dark:text-white font-semibold'
                      : 'bg-gray-50 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="truncate">{item.title}</span>
                  </div>

                  <span className="text-[11px] text-gray-400 shrink-0">{item.durationFormatted}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
