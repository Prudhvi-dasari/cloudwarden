import { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, Film, Music, Image as ImageIcon, File, Loader2, Sparkles, Check, Copy } from 'lucide-react';
import { activeStorageProvider } from '../lib/storageProvider';
import Portal from './Portal';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileTypeCategory(contentType, fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext) || contentType?.startsWith('image/')) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp'].includes(ext) || contentType?.startsWith('video/')) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext) || contentType?.startsWith('audio/')) return 'audio';
  if (['pdf'].includes(ext) || contentType === 'application/pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf', 'md', 'json', 'csv', 'js', 'py', 'html', 'css'].includes(ext)) return 'text';
  return 'file';
}

export default function FilePreviewModal({ file, shareId, onClose }) {
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [textContent, setTextContent] = useState('');

  const category = getFileTypeCategory(file?.content_type, file?.file_name);
  const downloadUrl = `${window.location.origin}/download/${shareId || file?.share_id}`;

  useEffect(() => {
    let isMounted = true;
    async function loadStream() {
      const previewShareId = shareId || file?.share_id;
      if (!file?.id || !previewShareId) return;
      setLoading(true);
      try {
        const url = await activeStorageProvider.getPreviewUrl(null, file.file_name || file.name, {
          shareId: previewShareId,
          fileId: file.id,
        });
        if (isMounted) {
          setStreamUrl(url);
          if (category === 'text') {
            try {
              const res = await fetch(url);
              if (res.ok) {
                const text = await res.text();
                if (isMounted) setTextContent(text.slice(0, 50000)); // Cap to 50KB for fast render
              }
            } catch (e) {}
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    }
    loadStream();
    return () => { isMounted = false; };
  }, [file]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectDownload = async () => {
    const url = await activeStorageProvider.getSignedDownloadUrl(null, file.file_name || file.name, {
      shareId: shareId || file.share_id,
      fileId: file.id,
    });
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (!file) return null;

  return (
    <Portal>
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 bg-slate-50/90">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-10 h-10 rounded-2xl theme-btn-primary flex items-center justify-center shrink-0 shadow-sm text-white">
              {category === 'image' && <ImageIcon className="w-5 h-5" />}
              {category === 'video' && <Film className="w-5 h-5" />}
              {category === 'audio' && <Music className="w-5 h-5" />}
              {category === 'pdf' && <FileText className="w-5 h-5" />}
              {category === 'text' && <FileText className="w-5 h-5" />}
              {category === 'file' && <File className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{file.file_name}</h3>
              <p className="text-xs text-slate-500 font-semibold">{formatBytes(file.file_size)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Share Link'}</span>
            </button>

            <button
              onClick={handleDirectDownload}
              className="px-3 py-1.5 rounded-xl theme-btn-primary text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Content Area */}
        <div className="flex-1 overflow-auto bg-slate-900/95 flex items-center justify-center p-3 sm:p-6 min-h-[300px] max-h-[70vh]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin theme-text" />
              <span className="text-sm font-semibold">Streaming preview from Cloud Edge CDN...</span>
            </div>
          ) : streamUrl ? (
            <>
              {category === 'image' && (
                <img
                  src={streamUrl}
                  alt={file.file_name}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-lg animate-fadeIn"
                />
              )}

              {category === 'video' && (
                <video
                  src={streamUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full rounded-2xl shadow-2xl bg-black"
                />
              )}

              {category === 'audio' && (
                <div className="w-full max-w-md p-6 bg-slate-800 rounded-3xl border border-slate-700 text-center space-y-4 shadow-2xl">
                  <div className="w-20 h-20 mx-auto rounded-full theme-btn-primary flex items-center justify-center shadow-lg animate-pulse">
                    <Music className="w-10 h-10 text-white" />
                  </div>
                  <h4 className="text-white font-bold text-base truncate">{file.file_name}</h4>
                  <audio src={streamUrl} controls autoPlay className="w-full" />
                </div>
              )}

              {category === 'pdf' && (
                <iframe
                  src={`${streamUrl}#toolbar=1&navpanes=0`}
                  title={file.file_name}
                  className="w-full h-[65vh] rounded-xl border border-slate-700 bg-white"
                />
              )}

              {category === 'text' && (
                <pre className="w-full max-h-[60vh] overflow-auto p-4 bg-slate-950 text-emerald-400 font-mono text-xs sm:text-sm rounded-2xl border border-slate-800 text-left">
                  {textContent || 'No text content or binary format.'}
                </pre>
              )}

              {category === 'file' && (
                <div className="text-center p-8 text-slate-400 space-y-3">
                  <File className="w-16 h-16 mx-auto text-slate-600" />
                  <p className="text-sm font-medium text-slate-300">Binary file preview not supported directly in browser.</p>
                  <button
                    onClick={handleDirectDownload}
                    className="px-5 py-2.5 rounded-xl theme-btn-primary text-white text-xs font-bold inline-flex items-center gap-2 shadow-md"
                  >
                    <Download className="w-4 h-4" /> Download to View
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-slate-400">
              <p className="text-sm">Preview stream offline.</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs font-medium text-slate-500">
          <span className="truncate">Public Link: <a href={downloadUrl} target="_blank" rel="noreferrer" className="theme-text font-bold hover:underline">{downloadUrl}</a></span>
          <span className="shrink-0 font-bold text-slate-700">Encrypted Cloud Storage</span>
        </div>
      </div>
    </div>
    </Portal>
  );
}
