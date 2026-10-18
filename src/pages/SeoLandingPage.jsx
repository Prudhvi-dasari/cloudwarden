import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SeoHead from '../components/SeoHead';
import { Send, Shield, Zap, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

const LANDING_DATA = {
  'send-large-files': {
    title: 'Send Large Files Online Free (Up to 6 GB) | iTransfer',
    metaDesc: 'Transfer huge files, 4K videos, and large zip archives across any device without compression or quality loss.',
    h1: 'Send Large Files Without Compression',
    subtitle: 'Send up to 6 GB by link, or move a file device to device. No signup. Links last up to 7 days.',
    feature1: 'Chunked TUS upload handles multi-GB files smoothly',
    feature2: 'Auto-resumes automatically if WiFi drops mid-upload',
    feature3: 'Original resolution & quality preserved 100%',
  },
  'send-files-by-email': {
    title: 'Send Files by Email (Large Attachments) | iTransfer',
    metaDesc: 'Bypass 25MB email attachment limits. Send large files directly to any recipient inbox with secure links.',
    h1: 'Send Large Files Directly to Inboxes',
    subtitle: 'Bypass Gmail & Outlook 25MB attachment limits. Send gigabytes of files with instant delivery.',
    feature1: 'Supports multiple recipient email addresses with private links',
    feature2: 'Instant inbox delivery and sender delivery receipts',
    feature3: 'Optional password protection & expiration controls',
  },
  'create-file-sharing-link': {
    title: 'Create Secure File Sharing Links Free | iTransfer',
    metaDesc: 'Generate secure download links for any file or folder. Share on WhatsApp, Slack, Teams, or SMS.',
    h1: 'Create Instant File Sharing Links',
    subtitle: 'Upload files and get a secure, shareable link in seconds. No account needed.',
    feature1: 'One-click copy and instant QR code for mobile downloads',
    feature2: 'Expiry from 1 hour up to 7 days',
    feature3: 'Self-destruct limits (purge after 1, 5, or 10 downloads)',
  },
  'file-request': {
    title: 'Request & Collect Files Online from Clients | iTransfer',
    metaDesc: 'Create a secure file drop link. Collect project assets, photos, and documents from clients without signup.',
    h1: 'Collect Files Securely from Anyone',
    subtitle: 'Create a dedicated file request link and receive uploads directly without forcing accounts on clients.',
    feature1: 'Clients upload directly from any browser without signing up',
    feature2: 'Automatic tracking in your transfer dashboard',
    feature3: 'Custom instructions, descriptions, and file categorization',
  },
  'iphone-to-windows': {
    title: 'AirDrop from iPhone to Windows PC | iTransfer',
    metaDesc: 'Transfer photos, videos, and files directly from iPhone to Windows PC in seconds. No iTunes or iCloud required.',
    h1: 'AirDrop from iPhone to Windows PC',
    subtitle: 'Move photos, 4K videos, and documents from your iPhone to Windows without installing any apps.',
    feature1: 'Scan QR code on iPhone to instantly pair with Windows',
    feature2: 'Direct browser-to-browser P2P speed',
    feature3: 'No cable or Bluetooth pairing required',
  },
  'android-to-mac': {
    title: 'Transfer Files from Android to Mac | iTransfer',
    metaDesc: 'Fastest way to transfer files between Android phones and Mac computers without Android File Transfer software.',
    h1: 'Transfer Files from Android to Mac',
    subtitle: 'Instant browser-based file sharing between Android and macOS.',
    feature1: 'Works in Safari and Chrome without extra drivers',
    feature2: 'Direct WebRTC high-speed file transfer',
    feature3: 'No cloud storage needed for direct transfers',
  },
  'phone-to-laptop': {
    title: 'Transfer Files from Phone to Laptop | iTransfer',
    metaDesc: 'Easily transfer photos, documents, and videos between mobile phones and laptops.',
    h1: 'Phone to Laptop File Transfer',
    subtitle: 'Scan a 6-character code or QR code to move files instantly between any phone and laptop.',
    feature1: 'Supports iPhone, Android, Windows, Mac, and Linux',
    feature2: 'Zero file compression for full quality',
    feature3: '100% free with no account required',
  },
  'airdrop-alternative': {
    title: 'Universal AirDrop Alternative for All Devices | iTransfer',
    metaDesc: 'AirDrop for everyone. Share files between Apple, Android, Windows, and Linux right from your browser.',
    h1: 'AirDrop for Everyone',
    subtitle: 'The universal cross-platform AirDrop alternative that works in every browser.',
    feature1: 'Browser-to-browser WebRTC direct transfers',
    feature2: 'Works on iOS, Android, macOS, Windows, Linux',
    feature3: 'No app download or account creation needed',
  },
  'wetransfer-alternative': {
    title: 'Free WeTransfer Alternative with No Compression | iTransfer',
    metaDesc: 'Send large files without sign up. Resumable uploads, password protection, and P2P direct transfer.',
    h1: 'The Modern WeTransfer Alternative',
    subtitle: 'Faster transfers, direct P2P connection, and auto-resumable uploads.',
    feature1: 'Disconnection-proof resumable uploads',
    feature2: 'Optional password protection & self-destruct limits',
    feature3: 'Up to 6 GB per cloud transfer, with no account',
  },
  'transfernow-alternative': {
    title: 'TransferNow Alternative with Direct P2P & Link Sharing | iTransfer',
    metaDesc: 'Fast, secure alternative to TransferNow. Send files via email, generate share links, or transfer direct device-to-device.',
    h1: 'The Superior TransferNow Alternative',
    subtitle: 'One place for every transfer: Direct P2P, email delivery, share links, and file requests.',
    feature1: 'Direct device-to-device WebRTC transfers with zero cloud upload',
    feature2: 'Free password protection and expiration controls',
    feature3: 'Clean, ad-free interface designed for speed',
  },
  'p2p-file-transfer': {
    title: 'Secure P2P File Transfer Browser to Browser | iTransfer',
    metaDesc: 'Direct peer-to-peer WebRTC file transfers. Files stream directly between devices without cloud storage.',
    h1: 'Peer-to-Peer File Transfer',
    subtitle: 'Direct browser-to-browser streaming powered by WebRTC.',
    feature1: 'Files travel directly through peer data channels',
    feature2: 'No cloud storage needed for active transfers',
    feature3: 'STUN & TURN relay fallback for firewalls',
  },
  'send-large-video': {
    title: 'Send 4K Videos Without Quality Loss | iTransfer',
    metaDesc: 'Share 4K video files, MP4, MOV, and raw footage without compression or resolution loss.',
    h1: 'Send High-Res Video Files',
    subtitle: 'Transfer raw 4K videos, MP4, and MOV files with zero compression.',
    feature1: 'Maintains 100% original video resolution',
    feature2: 'Supports multi-GB video file sizes',
    feature3: 'Fast streaming download for recipients',
  },
  'send-files-without-signup': {
    title: 'Send Files Online Without Sign Up | iTransfer',
    metaDesc: 'No account required. Upload and share files instantly without entering your email or creating a password.',
    h1: 'Send Files Without Sign Up',
    subtitle: 'Zero registration barrier. Select files, get a link, and share.',
    feature1: 'No login or credit card required',
    feature2: 'Instant link generation',
    feature3: 'Auto-purges after expiration',
  },
  'send-files-without-compression': {
    title: 'Send Files Without Compression or Quality Loss | iTransfer',
    metaDesc: 'Preserve original file quality. No image resizing, video re-encoding, or quality reduction.',
    h1: 'Send Files Without Compression',
    subtitle: 'Your files remain byte-for-byte identical to the original source.',
    feature1: 'Zero image or video re-encoding',
    feature2: 'Exact file checksum & byte integrity',
    feature3: 'Ideal for photographers and video editors',
  },
  'how-to-send-large-files': {
    title: 'How to Send Large Files Online Free (Step-by-Step, Up to 6 GB) | iTransfer',
    metaDesc: 'Learn how to send large files, heavy videos, and archives online for free without registration. Instant shareable link & direct P2P.',
    h1: 'How to Send Large Files Online for Free',
    subtitle: 'Send up to 6 GB with no signup. Links last up to 7 days.',
    feature1: 'Drag and drop a file up to 6 GB',
    feature2: 'Create instant link or send straight to recipient email',
    feature3: '100% free with no account required',
  },
  'file-transfer-free': {
    title: 'Send Files Online Free (6 GB, No Sign Up) — iTransfer',
    metaDesc: 'Send files online free up to 6 GB. No registration, optional password, and expiry up to 7 days.',
    h1: 'Free file transfer online',
    subtitle: 'Send up to 6 GB with no account. Links last up to 7 days.',
    feature1: 'No email or password needed to upload',
    feature2: 'Instant shareable links',
    feature3: 'TLS + AES-256 at rest with auto-expiration',
  },
  'send-files-whatsapp': {
    title: 'Send Large Files on WhatsApp via Link | iTransfer',
    metaDesc: 'Bypass WhatsApp size limits. Upload once, share a secure download link in any chat.',
    h1: 'Send large files on WhatsApp',
    subtitle: 'Create a link in seconds and paste it into WhatsApp — no compression, no app install.',
    feature1: 'Works with WhatsApp Web and mobile',
    feature2: 'Optional password before download',
    feature3: 'Free up to 6 GB per transfer',
  },
  'send-folder-online': {
    title: 'Send Folders Online Free | iTransfer',
    metaDesc: 'Upload entire folders with nested structure preserved. Share one link with recipients.',
    h1: 'Send folders online',
    subtitle: 'Select a folder, keep the directory tree, and share a single download link.',
    feature1: 'Nested folder structure preserved',
    feature2: 'ZIP-all download for recipients',
    feature3: 'No signup required',
  },
  'expire-file-link': {
    title: 'Auto-Expiring File Links & Password Gates | iTransfer',
    metaDesc: 'Create download links that expire in hours or days, with free password protection.',
    h1: 'Expiring file links',
    subtitle: 'Choose from 1 hour up to 7 days. Longer retention is not available yet.',
    feature1: '1 hour to 7 day free expiry',
    feature2: 'Free password protection',
    feature3: 'Objects purged after expiry',
  },
  'best-wetransfer-alternative-india': {
    title: 'Best WeTransfer Alternative in India | iTransfer',
    metaDesc: 'Send up to 6 GB with no signup, plus device transfer and no ads. Larger plans are not available yet.',
    h1: 'WeTransfer alternative for India',
    subtitle: 'Fast edge transfers, free passwords, device P2P, and Pro with UPI — built for Indian creators and teams.',
    feature1: 'Free 6 GB cloud transfer, plus device transfer',
    feature2: 'UPI-ready Pro upgrades',
    feature3: 'Mumbai edge · no signup nags',
  },
};

export default function SeoLandingPage({ pageKey }) {
  const data = LANDING_DATA[pageKey] || LANDING_DATA['airdrop-alternative'];

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
      <SeoHead
        customTitle={data.title}
        customDescription={data.metaDesc}
        customCanonical={`https://itransfer.iprudhvi.in/${pageKey}`}
      />
<header className="sticky top-0 z-40 bg-transparent border-b border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl theme-btn-primary flex items-center justify-center shadow-md">
              <Send className="w-5 h-5 text-[#0c0b0a]" />
            </div>
            <span className="text-xl font-display font-semibold tracking-tight text-white italic">iTransfer</span>
          </Link>

          <Link
            to="/"
            className="theme-btn-primary px-4 py-2 text-xs font-semibold rounded-full inline-flex items-center gap-1.5"
          >
            <span>Transfer Files Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 relative z-10">

        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold theme-bg-light theme-text mb-3 border border-[#c4a574]/25">
            <Sparkles className="w-3.5 h-3.5" /> SEO Guide
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-semibold text-white tracking-tight mb-3">
            {data.h1}
          </h1>
          <p className="text-sm sm:text-base text-white/55 max-w-xl mx-auto leading-relaxed">
            {data.subtitle}
          </p>
        </div>

        <div className="custom-card p-8 sm:p-10 text-center max-w-xl mx-auto mb-12 border-[#c4a574]/30 relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl theme-btn-primary flex items-center justify-center mx-auto mb-4 shadow-md">
            <Send className="w-8 h-8 text-[#0c0b0a]" />
          </div>

          <h3 className="text-xl font-display font-semibold text-white mb-2">Ready to Transfer?</h3>
          <p className="text-xs text-white/55 mb-6 max-w-sm mx-auto">
            Choose between direct device streaming, email delivery, or an instant download link.
          </p>

          <Link
            to="/"
            className="theme-btn-primary w-full py-4 text-sm font-semibold rounded-full inline-flex items-center justify-center gap-2"
          >
            <span>Start Transferring on iTransfer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="custom-card p-6 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-[#8fbc8f]/15 text-[#8fbc8f] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white">{data.feature1}</h3>
            <p className="text-xs text-white/55 leading-relaxed">Engineered for maximum reliability across mobile and desktop devices.</p>
          </div>

          <div className="custom-card p-6 space-y-2">
            <div className="w-10 h-10 rounded-xl theme-bg-light theme-text flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white">{data.feature2}</h3>
            <p className="text-xs text-white/55 leading-relaxed">Protected with auto-expiration and optional password encryption.</p>
          </div>

          <div className="custom-card p-6 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-[#c4a574]/15 theme-text flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white">{data.feature3}</h3>
            <p className="text-xs text-white/55 leading-relaxed">Full original quality preserved with zero compression or downscaling.</p>
          </div>
        </div>

      </main>

      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="pt-8 border-t border-white/10">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-white text-black text-sm font-semibold px-5 py-3 hover:bg-white/90">
            Send a file
          </Link>
        </div>
      </div>

      <Footer />

    </div>
  );
}
