import { useState, useEffect } from 'react';
import { X, Download, FileText, Film, Music, Image as ImageIcon, File, Check, Copy } from 'lucide-react';
import { activeStorageProvider } from '../lib/storageProvider';
import Portal from './Portal';

const TYPE_ICONS = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  text: FileText,
  file: File,
};

function fileExt(name) {
  const parts = String(name || '').split('.');
  if (parts.length < 2) return '';
  return parts.pop().slice(0, 5).toUpperCase();
}

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
            } catch {
              // Ignore preview fetch errors
            }
          }
          setLoading(false);
        }
      } catch {
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

  const TypeIcon = TYPE_ICONS[category] || File;
  const ext = fileExt(file.file_name);

  return (
    <Portal>
    <div className="ds-modal-backdrop z-[10000]">
      <div className="ds-modal is-wide dl-preview" role="dialog" aria-modal="true" aria-labelledby="file-preview-title">

        <div className="dl-preview-head">
          <span className="dl-type is-sm" data-kind={category} aria-hidden="true">
            <TypeIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="file-preview-title" className="dl-preview-title" title={file.file_name}>{file.file_name}</h3>
            <p className="dl-preview-sub">{ext ? `${ext} · ` : ''}{formatBytes(file.file_size)}</p>
          </div>

          <div className="dl-preview-tools">
            <button
              type="button"
              onClick={handleCopyLink}
              aria-label={copied ? 'Link copied' : 'Copy link'}
              className="ds-btn ds-btn-ghost ds-btn-sm min-h-11 sm:min-h-9"
            >
              {copied ? <Check className="w-4 h-4 text-[var(--ds-green)]" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy link'}</span>
            </button>

            <button
              type="button"
              onClick={handleDirectDownload}
              aria-label="Download"
              className="ds-btn ds-btn-dark ds-btn-sm min-h-11 sm:min-h-9"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="ds-close"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="dl-preview-body" aria-live="polite">
          {loading ? (
            <p className="dl-preview-wait">
              <span className="ds-spinner" aria-hidden="true" />
              Loading preview…
            </p>
          ) : streamUrl ? (
            <>
              {category === 'image' && (
                <img src={streamUrl} alt={file.file_name} />
              )}

              {category === 'video' && (
                <video src={streamUrl} controls autoPlay playsInline />
              )}

              {category === 'audio' && (
                <div className="dl-preview-audio">
                  <span className="dl-type" data-kind="audio" aria-hidden="true">
                    <Music />
                  </span>
                  <p className="dl-preview-title max-w-full">{file.file_name}</p>
                  <audio src={streamUrl} controls autoPlay />
                </div>
              )}

              {category === 'pdf' && (
                <iframe src={`${streamUrl}#toolbar=1&navpanes=0`} title={file.file_name} />
              )}

              {category === 'text' && (
                <pre>{textContent || 'No text content or binary format.'}</pre>
              )}

              {category === 'file' && (
                <div className="ds-empty">
                  <span className="dl-type" aria-hidden="true">
                    <File />
                  </span>
                  <h3>No preview for this file type</h3>
                  <p>Download it to open it on your device.</p>
                  <button type="button" onClick={handleDirectDownload} className="ds-btn ds-btn-dark mt-2">
                    <Download className="w-4 h-4" aria-hidden="true" /> Download to open
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="dl-preview-wait">The preview could not be loaded.</p>
          )}
        </div>

        <div className="dl-preview-foot">
          <p className="dl-preview-link">
            Public link: <a href={downloadUrl} target="_blank" rel="noreferrer">{downloadUrl}</a>
          </p>
        </div>
      </div>
    </div>
    </Portal>
  );
}
