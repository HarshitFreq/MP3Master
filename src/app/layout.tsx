import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MP3Master - Personal YouTube Audio Downloader',
  description: 'Download high-quality MP3 audio directly from YouTube videos using yt-dlp and FFmpeg. Fast, responsive, personal studio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="font-sans antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
