'use client';

import React, { useState, useCallback } from 'react';
import { Search, Clipboard, ArrowRight, XCircle, Disc } from 'lucide-react';
import { parseYouTubeUrl } from '@/lib/utils';
import { isExternalMusicUrl } from '@/lib/musicImporter';
import { VideoMetadata } from '@/lib/types';

interface UrlDropInputProps {
  url: string;
  setUrl: (url: string) => void;
  onSubmit: (cleanUrl: string) => void;
  loading: boolean;
  onSelectSearchResult?: (metadata: VideoMetadata) => void;
}

export const UrlDropInput: React.FC<UrlDropInputProps> = ({
  url,
  setUrl,
  onSubmit,
  loading,
  onSelectSearchResult,
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VideoMetadata[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (droppedText) {
      processInput(droppedText.trim());
    }
  }, []);

  const processInput = async (inputText: string) => {
    if (!inputText) return;
    setErrorText(null);
    setSearchResults([]);

    // Check YouTube URL
    const parsed = parseYouTubeUrl(inputText);
    if (parsed.isValid && parsed.cleanUrl) {
      setUrl(parsed.cleanUrl);
      onSubmit(parsed.cleanUrl);
      return;
    }

    // Check Spotify or Apple Music URL
    const external = isExternalMusicUrl(inputText);
    if (external.isExternal) {
      setUrl(inputText);
      onSubmit(inputText);
      return;
    }

    // Otherwise treat as song search query!
    setSearchLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: inputText }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No search results found.');
      }
      setSearchResults(data.results || []);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processInput(query);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setQuery(text);
        processInput(text);
      }
    } catch {}
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl transition-all duration-300 ${
          isDragging ? 'ring-2 ring-rose-500 scale-[1.01]' : ''
        }`}
      >
        <form onSubmit={handleFormSubmit} className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setErrorText(null);
            }}
            placeholder="Paste YouTube, Spotify, or Apple Music link, or song name..."
            className="w-full px-5 py-4 pl-12 pr-28 rounded-2xl bg-white dark:bg-[#0f1422] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:border-rose-500/50 shadow-lg shadow-black/5 transition-all"
            disabled={loading || searchLoading}
          />

          {/* Search/URL Icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {searchLoading || loading ? (
              <Disc className="w-4 h-4 animate-spin text-rose-500" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>

          {/* Right Action buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {!query && (
              <button
                type="button"
                onClick={handlePaste}
                className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 text-xs font-medium transition-colors flex items-center gap-1"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Paste</span>
              </button>
            )}

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSearchResults([]);
                  setErrorText(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={!query.trim() || loading || searchLoading}
              className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white transition-all"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Error Notification */}
        {errorText && (
          <p className="mt-2 text-xs text-rose-500 font-medium px-2">{errorText}</p>
        )}

        {/* Search Results List */}
        {searchResults.length > 0 && (
          <div className="mt-3 p-2 rounded-2xl bg-white dark:bg-[#0f1422] border border-gray-200 dark:border-white/10 shadow-2xl space-y-1">
            {searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setUrl(item.url);
                  setSearchResults([]);
                  if (onSelectSearchResult) {
                    onSelectSearchResult(item);
                  } else {
                    onSubmit(item.url);
                  }
                }}
                className="cursor-pointer p-2.5 rounded-xl hover:bg-rose-500/10 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-rose-500">
                      {item.title}
                    </h5>
                    <p className="text-[11px] text-gray-400 truncate">
                      {item.uploader} {item.durationFormatted && `• ${item.durationFormatted}`}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-bold text-rose-500 px-2.5 py-1 rounded-lg bg-rose-500/10 shrink-0">
                  Download
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
