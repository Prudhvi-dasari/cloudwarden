import { useState, useEffect, useRef } from 'react';
import {
  FileText, Image, Film, Music, Archive, File, Trash2,
  HardDrive, Plus, FolderPlus, Layers
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

function getBadgeColor(ext) {
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'prores'].includes(ext)) return 'bg-violet-50 text-violet-700 border-violet-200';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileList({ files, onRemoveFile, onAddMore, onFilesAdded, maxSizeBytes = 5 * 1024 * 1024 * 1024 }) {
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
        } catch (e) {}
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
    <div className="space-y-3.5 mb-4 animate-scale-in">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Selected Files</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
                {files.length}
              </span>
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {formatBytes(totalSize)} total
          </p>
        </div>

        {/* Quick Add More Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all active:scale-98 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Files</span>
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all active:scale-98 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>Folder</span>
          </button>
        </div>
      </div>

      {/* Storage Capacity Bar */}
      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
        <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
          <span className="text-slate-600">Storage Capacity</span>
          <span className={totalSize > maxSizeBytes ? 'text-rose-600 font-bold' : 'text-slate-700'}>
            {formatBytes(totalSize)} of {formatBytes(maxSizeBytes)}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              totalSize > maxSizeBytes ? 'bg-rose-500' : 'bg-indigo-600'
            }`}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
      </div>

      {/* Scrollable File Items */}
      <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {files.map((file, index) => {
          const ext = file.name?.split('.').pop()?.toLowerCase() || '';
          const IconComponent = getFileIcon(file.type, file.name);
          const previewUrl = previews[index];
          const badgeClass = getBadgeColor(ext);

          return (
            <li
              key={index}
              className="flex items-center justify-between p-2.5 bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                    <IconComponent className="w-5 h-5 text-indigo-600" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      {file.name}
                    </p>
                    {ext && (
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${badgeClass}`}>
                        {ext}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-2 cursor-pointer shrink-0"
                title="Remove file"
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
