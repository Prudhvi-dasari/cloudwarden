import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDropzone } from 'react-dropzone';
import {
  FilePlus, FolderPlus, ShieldCheck, Clock, Gift, UserX,
  AlertTriangle, ArrowDown, FileArchive, FileImage, FileVideo,
} from 'lucide-react';

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'vbs', 'vbe', 'jse', 'wsf', 'wsh',
  'msc', 'msi', 'msp', 'com', 'scr', 'hta', 'cpl', 'pif', 'reg', 'dll',
  'ps1', 'ps2', 'apk'
]);

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function DropArt({ hot = false, size = 'md' }) {
  return (
    <div className={`ds-drop-art is-${size} ${hot ? 'is-hot' : ''}`} aria-hidden="true">
      <span className="ds-drop-ripple" />
      <span className="ds-drop-ripple is-late" />
      <span className="ds-drop-tray-back" />
      <span className="ds-drop-doc is-a">
        <FileImage />
        <em>JPG</em>
      </span>
      <span className="ds-drop-doc is-b">
        <FileArchive />
        <em>ZIP</em>
      </span>
      <span className="ds-drop-doc is-c">
        <FileVideo />
        <em>MP4</em>
      </span>
      <span className="ds-drop-tray-front">
        <span className="ds-drop-arrow"><ArrowDown /></span>
      </span>
    </div>
  );
}

export default function DropZone({ onFilesSelected, windowDrop = false }) {
  const [securityAlert, setSecurityAlert] = useState(null);
  const [windowDragging, setWindowDragging] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const alertTimer = useRef(null);

  useEffect(() => () => clearTimeout(alertTimer.current), []);

  const filterSafeFiles = useCallback((rawFiles) => {
    const safe = [];
    const blocked = [];
    for (const f of rawFiles) {
      const ext = f.name?.split('.').pop()?.toLowerCase();
      if (ext && DANGEROUS_EXTENSIONS.has(ext)) {
        blocked.push(f.name);
      } else {
        safe.push(f);
      }
    }

    if (blocked.length > 0) {
      setSecurityAlert(`Blocked ${blocked.length} executable file${blocked.length === 1 ? '' : 's'} for your safety.`);
      clearTimeout(alertTimer.current);
      alertTimer.current = setTimeout(() => setSecurityAlert(null), 8000);
    }
    return safe;
  }, []);

  const onDrop = useCallback(
    (acceptedFiles) => {
      setWindowDragging(false);
      if (acceptedFiles?.length > 0) {
        const safeFiles = filterSafeFiles(acceptedFiles);
        if (safeFiles.length > 0) onFilesSelected(safeFiles);
      }
    },
    [onFilesSelected, filterSafeFiles]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const overlayZone = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    onDragLeave: () => setWindowDragging(false),
  });

  // A file dragged anywhere over the window opens a full-page drop target.
  useEffect(() => {
    if (!windowDrop) return undefined;
    let depth = 0;
    const enter = (event) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setWindowDragging(true);
    };
    const leave = (event) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setWindowDragging(false);
    };
    const reset = () => {
      depth = 0;
      setWindowDragging(false);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', reset);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', reset);
      window.removeEventListener('dragend', reset);
    };
  }, [windowDrop]);

  const handleNativeFileChange = (e) => {
    e.stopPropagation();
    if (e.target.files?.length > 0) {
      const safe = filterSafeFiles(Array.from(e.target.files));
      if (safe.length > 0) onFilesSelected(safe);
    }
    e.target.value = '';
  };

  const triggerFileSelect = (e) => {
    if (e) e.stopPropagation();
    try {
      open();
    } catch {
      fileInputRef.current?.click();
    }
  };

  const triggerFolderSelect = (e) => {
    if (e) e.stopPropagation();
    folderInputRef.current?.click();
  };

  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerFileSelect();
    }
  };

  const hot = isDragActive;

  return (
    <div className="w-full relative z-20">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleNativeFileChange} />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory="true"
        mozdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleNativeFileChange}
      />

      {securityAlert && (
        <div role="alert" className="ds-alert is-danger mb-3">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{securityAlert}</span>
        </div>
      )}

      <div
        {...getRootProps({ onKeyDown })}
        onClick={triggerFileSelect}
        role="button"
        tabIndex={0}
        aria-label="Choose files to send, or drop them here"
        className={`ds-drop ${hot ? 'is-drag' : ''}`}
      >
        <input {...getInputProps({ 'aria-label': 'Choose files to send' })} />
        <svg className="ds-drop-border" aria-hidden="true">
          <rect x="1" y="1" rx="21" ry="21" />
        </svg>
        <p className="sr-only" aria-live="polite">
          {hot ? 'Release to add your files' : ''}
        </p>

        <DropArt hot={hot} />

        <div className="ds-drop-copy">
          <h3 className="ds-drop-title">
            {hot ? 'Release to add them' : 'Drop files or a folder'}
          </h3>
          <p className="ds-drop-sub">
            {hot ? 'We will list them before anything uploads.' : 'Or browse your device. 6 GB free, no account.'}
          </p>
        </div>

        <div className="ds-drop-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={triggerFileSelect} className="ds-btn ds-btn-dark">
            <FilePlus className="w-4 h-4" aria-hidden="true" />
            Browse Files
          </button>
          <button type="button" onClick={triggerFolderSelect} className="ds-btn ds-btn-ghost">
            <FolderPlus className="w-4 h-4" aria-hidden="true" />
            Select Folder
          </button>
        </div>

        <ul className="ds-drop-meta" aria-label="Free plan">
          <li><Gift aria-hidden="true" />6 GB free</li>
          <li><Clock aria-hidden="true" />Up to 7 days</li>
          <li><UserX aria-hidden="true" />No signup</li>
          <li><ShieldCheck aria-hidden="true" />Executables blocked</li>
        </ul>
      </div>

      {windowDrop && windowDragging && typeof document !== 'undefined' && createPortal(
        <div {...overlayZone.getRootProps()} className="ds-drop-overlay" role="presentation">
          <input {...overlayZone.getInputProps({ 'aria-hidden': true, tabIndex: -1 })} />
          <div className="ds-drop-overlay-card">
            <DropArt hot size="lg" />
            <p className="ds-drop-overlay-title">Drop anywhere to add</p>
            <p className="ds-drop-overlay-sub">Up to 6 GB free. Executable files are blocked.</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
