import { useState, useEffect, useRef } from 'react';
import {
  FileText, Image, Film, Music, Archive, File, Trash2,
  Plus, FolderPlus
} from 'lucide-react';

function getFileIcon(contentType, fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'raw'].includes(ext) || contentType?.startsWith('image/')) return Image;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'prores'].includes(ext) || contentType?.startsWith('video/')) return Film;
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || contentType?.startsWith('audio/')) return Music;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return Archive;
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'xlsx', 'pptx', 'csv'].includes(ext)) return FileText;
  return File;
}

const KIND_BY_ICON = new Map([
  [Image, 'image'],
  [Film, 'video'],
  [Music, 'audio'],
  [Archive, 'archive'],
  [FileText, 'doc'],
]);

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileList({ files, onRemoveFile, onAddMore, onFilesAdded, maxSizeBytes = 6_000_000_000, maxSizeLabel = '' }) {
  const [previews, setPreviews] = useState({});
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const addHandler = onAddMore || onFilesAdded;

  useEffect(() => {
    const newPreviews = {};
    files.forEach((file, index) => {
      if (file.type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(file.name.split('.').pop()?.toLowerCase())) {
        try {
          newPreviews[index] = URL.createObjectURL(file);
        } catch {}
      }
    });
    setPreviews(newPreviews);

    return () => {
      Object.values(newPreviews).forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleAddFiles = (e) => {
    if (e.target.files?.length > 0 && addHandler) {
      addHandler(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleAddFolder = (e) => {
    if (e.target.files?.length > 0 && addHandler) {
      addHandler(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  if (!files || files.length === 0) return null;

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const usagePercent = Math.min(100, Math.round((totalSize / maxSizeBytes) * 100));

  return (
    <div className="snd-files">
      {/* Hidden File/Folder Inputs for Add More */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAddFiles}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleAddFolder}
        webkitdirectory="true"
        mozdirectory="true"
        directory="true"
        multiple
        className="hidden"
      />

      {/* Header Bar */}
      <div className="snd-files-head">
        <div className="min-w-0">
          <h4 className="snd-files-title">
            <span>Selected files</span>
            <span className="ds-badge ds-badge-blue">{files.length}</span>
          </h4>
          <p className="snd-files-sub">{formatBytes(totalSize)} total</p>
        </div>

        {/* Quick Add More Actions */}
        <div className="snd-files-actions">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ds-btn ds-btn-ghost ds-btn-sm"
          >
            <Plus aria-hidden="true" />
            <span>Add files</span>
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="ds-btn ds-btn-ghost ds-btn-sm"
          >
            <FolderPlus aria-hidden="true" />
            <span>Folder</span>
          </button>
        </div>
      </div>

      {/* Storage Capacity Bar */}
      <div className={`snd-meter${totalSize > maxSizeBytes ? ' is-over' : ''}`}>
        <div className="snd-meter-row">
          <span>This transfer</span>
          <b>{formatBytes(totalSize)} of {maxSizeLabel || formatBytes(maxSizeBytes)}</b>
        </div>
        <div className="ds-progress" aria-hidden="true">
          <i style={{ width: `${Math.min(100, usagePercent)}%` }} />
        </div>
      </div>

      {/* Scrollable File Items */}
      <ul className="snd-file-list">
        {files.map((file, index) => {
          const ext = file.name?.split('.').pop()?.toLowerCase() || '';
          const IconComponent = getFileIcon(file.type, file.name);
          const previewUrl = previews[index];

          return (
            <li key={`${file.name}-${file.size}-${index}`} className="snd-file">
              <span className="snd-ftile" data-kind={KIND_BY_ICON.get(IconComponent) || 'other'}>
                {previewUrl ? (
                  <img src={previewUrl} alt={file.name} />
                ) : (
                  <IconComponent aria-hidden="true" />
                )}
              </span>

              <div className="snd-file-main">
                <div className="snd-file-name">
                  <p title={file.name}>{file.name}</p>
                  {ext && <span className="snd-ext">{ext}</span>}
                </div>
                <p className="snd-size">{formatBytes(file.size)}</p>
              </div>

              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="snd-icon-btn is-danger"
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
