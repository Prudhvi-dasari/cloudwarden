import { useState, useEffect, useRef } from 'react';
import { FileText, Image, Film, Music, Archive, File, Trash2, HardDrive, PlusCircle, Sparkles } from 'lucide-react';

function getFileIcon(contentType, fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || contentType?.startsWith('image/')) return Image;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || contentType?.startsWith('video/')) return Film;
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || contentType?.startsWith('audio/')) return Music;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive;
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return FileText;
  return File;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileList({ files, onRemoveFile, onFilesAdded }) {
  const [previews, setPreviews] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    const newPreviews = {};
    files.forEach((file, index) => {
      if (file.type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(file.name.split('.').pop()?.toLowerCase())) {
        newPreviews[index] = URL.createObjectURL(file);
      }
    });
    setPreviews(newPreviews);

    return () => {
      Object.values(newPreviews).forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleAddFiles = (e) => {
    if (e.target.files?.length > 0 && onFilesAdded) {
      onFilesAdded(Array.from(e.target.files));
    }
  };

  if (!files || files.length === 0) return null;

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-3 animate-scale-in">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 px-1">
        <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <HardDrive className="w-4 h-4 theme-text" /> Selected Files ({files.length})
        </h4>

        <div className="flex items-center gap-2 self-end xs:self-auto">
          <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            {formatBytes(totalSize)}
          </span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-bold theme-text hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add More</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAddFiles}
            multiple
            className="hidden"
          />
        </div>
      </div>

      <ul className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {files.map((file, index) => {
          const IconComponent = getFileIcon(file.type, file.name);
          const previewUrl = previews[index];

          return (
            <li
              key={index}
              className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/80 transition-all group"
            >
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg theme-bg-light theme-text flex items-center justify-center shrink-0">
                    <IconComponent className="w-5 h-5" />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500 font-semibold">{formatBytes(file.size)}</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-2"
                title="Remove file"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
