import { UploadCloud, Link2, Mail, Wifi, FilePlus, FolderPlus } from 'lucide-react';

/**
 * Static picture of the current browser transfer.
 * Not an uploader — the live drop zone stays on the homepage.
 */
export default function ProductStage() {
  return (
    <div className="product-replica" aria-hidden="true">
      <div className="noir-segment inline-flex flex-wrap justify-center gap-1 max-w-full">
        <span className="noir-segment-item active px-3.5 py-2 inline-flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          Link
        </span>
        <span className="noir-segment-item px-3.5 py-2 inline-flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Email
        </span>
        <span className="noir-segment-item px-3.5 py-2 inline-flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5" />
          Device
        </span>
      </div>

      <div className="drop-card rounded-[28px] text-[#1c1917] p-6 sm:p-8 text-center w-full">
        <div className="drop-orbit">
          <svg className="drop-orbit-svg" viewBox="0 0 120 120">
            <circle className="orbit-dash" cx="60" cy="60" r="54" />
            <circle className="orbit-dash inner" cx="60" cy="60" r="46" />
          </svg>
          <span className="drop-orbit-core">
            <UploadCloud className="w-7 h-7 stroke-[2.2]" />
          </span>
        </div>
        <p className="text-base sm:text-lg font-display font-semibold text-[#1c1917] tracking-tight">
          Drop files or folders here
        </p>
        <p className="mt-1.5 text-xs sm:text-sm text-[#57534e] font-medium max-w-sm mx-auto leading-relaxed">
          Or browse. Folders work too. Up to 6 GB, no account.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1c1917] px-5 text-sm font-semibold text-white">
            <FilePlus className="w-4 h-4" />
            Browse Files
          </span>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-[#f4f1ea] px-5 text-sm font-semibold text-[#1c1917]">
            <FolderPlus className="w-4 h-4" />
            Select Folder
          </span>
        </div>
      </div>
    </div>
  );
}
