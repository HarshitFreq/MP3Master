'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { UrlDropInput } from '@/components/UrlDropInput';
import { VideoPreviewCard } from '@/components/VideoPreviewCard';
import { ProgressCard } from '@/components/ProgressCard';
import { DownloadHistory } from '@/components/DownloadHistory';
import { BinaryHealth, DownloadHistoryItem, DownloadProgress, DownloadQuality, VideoMetadata } from '@/lib/types';

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [health, setHealth] = useState<BinaryHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<DownloadQuality>('320');
  
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);

  // Dark Mode Class Sync
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load binary health
  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({
        ytdlpInstalled: false,
        ffmpegInstalled: false,
        recommendedCommand: 'brew install yt-dlp ffmpeg',
      });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mp3master_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const saveToHistory = (item: DownloadHistoryItem) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.url !== item.url);
      const updated = [item, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('mp3master_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('mp3master_history');
    } catch {}
  };

  // Trigger browser file save
  const handleDownloadFile = (fileId: string, fileName?: string) => {
    const link = document.createElement('a');
    const paramName = fileName ? `?filename=${encodeURIComponent(fileName)}` : '';
    link.href = `/api/file/${fileId}${paramName}`;
    link.download = fileName || `download-${fileId.substring(0, 8)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch Video / Playlist Metadata
  const handleFetchInfo = async (cleanUrl: string) => {
    setInfoLoading(true);
    setInfoError(null);
    setMetadata(null);
    setProgress(null);

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to retrieve media details.');
      }

      setMetadata(data.metadata);
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Error fetching media information.');
    } finally {
      setInfoLoading(false);
    }
  };

  // Start Single Video Download
  const handleStartDownload = async (targetUrl?: string, targetMeta?: VideoMetadata) => {
    const activeUrl = targetUrl || url;
    const activeMeta = targetMeta || metadata;

    if (!activeUrl || !activeMeta) return;

    setUrl(activeUrl);
    setMetadata(activeMeta);

    setProgress({
      id: '',
      url: activeUrl,
      quality,
      stage: 'fetching_info',
      percent: 0,
      statusText: 'Connecting...',
      metadata: activeMeta,
    });

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeUrl, quality, metadata: activeMeta }),
      });

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to start download stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const chunk of lines) {
          const trimmed = chunk.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.replace('data: ', ''));
              setProgress(payload);

              if (payload.stage === 'completed' && payload.fileId) {
                handleDownloadFile(payload.fileId, payload.fileName);
                saveToHistory({
                  id: payload.fileId,
                  url: activeMeta.url,
                  title: activeMeta.title,
                  uploader: activeMeta.uploader,
                  thumbnail: activeMeta.thumbnail,
                  durationFormatted: activeMeta.durationFormatted,
                  quality,
                  downloadedAt: Date.now(),
                  fileId: payload.fileId,
                });
              }
            } catch (e) {
              console.error('Error parsing SSE payload:', e);
            }
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Stream processing error';
      setProgress({
        id: '',
        url: activeUrl,
        quality,
        stage: 'error',
        percent: 0,
        error: errMsg,
        statusText: `Error: ${errMsg}`,
      });
    }
  };

  // Start Batch / Playlist Download
  const handleStartBatchDownload = async (selectedItems: VideoMetadata[]) => {
    if (!selectedItems || selectedItems.length === 0) return;

    setProgress({
      id: '',
      url,
      quality,
      stage: 'downloading',
      percent: 0,
      isBatch: true,
      currentTrackIndex: 1,
      totalTracks: selectedItems.length,
      currentTrackTitle: selectedItems[0].title,
      statusText: `Starting batch download of ${selectedItems.length} tracks...`,
    });

    try {
      const response = await fetch('/api/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems, quality, playlistTitle: metadata?.title || 'Playlist' }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to connect to batch download stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const chunk of lines) {
          const trimmed = chunk.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.replace('data: ', ''));
              setProgress(payload);

              if (payload.stage === 'completed') {
                if (payload.zipFileId) {
                  handleDownloadFile(payload.zipFileId, payload.zipFileName);
                }

                saveToHistory({
                  id: payload.zipFileId || crypto.randomUUID(),
                  url: url || selectedItems[0].url,
                  title: metadata?.title || `Playlist (${selectedItems.length} tracks)`,
                  uploader: `${selectedItems.length} tracks`,
                  thumbnail: selectedItems[0].thumbnail,
                  durationFormatted: `${selectedItems.length} files`,
                  quality,
                  downloadedAt: Date.now(),
                  isBatch: true,
                });
              }
            } catch (e) {
              console.error('Error parsing batch SSE payload:', e);
            }
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Batch process error';
      setProgress({
        id: '',
        url,
        quality,
        stage: 'error',
        percent: 0,
        error: errMsg,
        statusText: `Error: ${errMsg}`,
      });
    }
  };

  const handleSelectSearchResult = (selectedMetadata: VideoMetadata) => {
    setUrl(selectedMetadata.url);
    setMetadata(selectedMetadata);
    setInfoError(null);
    handleStartDownload(selectedMetadata.url, selectedMetadata);
  };

  const handleReset = () => {
    setProgress(null);
    setMetadata(null);
    setUrl('');
    setInfoError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#07090e] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      
      {/* Header */}
      <Header
        health={health}
        healthLoading={healthLoading}
        onRefreshHealth={checkHealth}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-16 pb-12 flex flex-col justify-start">
        
        {/* Minimal Hero Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            YouTube <span className="text-rose-500">MP3</span> Downloader
          </h1>
        </div>

        {/* Input Bar */}
        <UrlDropInput
          url={url}
          setUrl={setUrl}
          onSubmit={handleFetchInfo}
          loading={infoLoading}
          onSelectSearchResult={handleSelectSearchResult}
        />

        {/* Info Error Card */}
        {infoError && (
          <div className="w-full max-w-2xl mx-auto mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs text-center font-medium">
            {infoError}
          </div>
        )}

        {/* Live Progress or Video/Playlist Preview */}
        {progress ? (
          <ProgressCard
            progress={progress}
            onReset={handleReset}
            onDownloadFile={handleDownloadFile}
          />
        ) : (
          metadata && (
            <VideoPreviewCard
              metadata={metadata}
              quality={quality}
              setQuality={setQuality}
              onStartDownload={() => handleStartDownload()}
              onStartBatchDownload={handleStartBatchDownload}
              isDownloading={false}
            />
          )
        )}

        {/* Recent History */}
        <DownloadHistory
          history={history}
          onClearHistory={handleClearHistory}
          onSelectHistoryItem={(selectedUrl) => {
            setUrl(selectedUrl);
            handleFetchInfo(selectedUrl);
          }}
        />

      </main>
    </div>
  );
}
