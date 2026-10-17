import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SeoHead from '../components/SeoHead';
import { Send, Shield, Zap, CheckCircle2, ArrowRight, Smartphone, Laptop, Lock, Wifi, Mail, Link2, Inbox, Sparkles, HelpCircle } from 'lucide-react';

const LANDING_DATA = {
  'send-large-files': {
    title: 'Send Large Files Online Free (Up to 25GB) | iTransfer',
    metaDesc: 'Transfer huge files, 4K videos, and large zip archives across any device without compression or quality loss.',
    h1: 'Send Large Files Without Compression',
    subtitle: 'Transfer up to 25GB directly between devices or via auto-expiring links. Zero signup required.',
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
    feature2: 'Custom expiration times from 24 hours to 30 days',
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
    feature3: 'Up to 25GB per transfer with zero subscription forced',
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
    title: 'How to Send Large Files Online Free (Step-by-Step, Up to 25GB) | iTransfer',
    metaDesc: 'Learn how to send large files, heavy videos, and archives online for free without registration. Instant shareable link & direct P2P.',
    h1: 'How to Send Large Files Online for Free',
    subtitle: 'Step-by-step guide & instant gigabit tool to transfer up to 25GB with zero signup.',
    feature1: 'Drag & drop any file up to 25GB directly',
    feature2: 'Create instant link or send straight to recipient email',
    feature3: '100% free with no account required',
  },
  'file-transfer-free': {
    title: '[100% Free] Send Files Online Free (Up to 25GB, No Sign Up) — iTransfer',
    metaDesc: 'Send files online completely free up to 25GB. No registration, no credit card, and no hidden fees. Instant download link.',
    h1: '100% Free File Transfer Online',
    subtitle: 'Send large files up to 25GB with zero account required. Fast, encrypted, and free forever.',
    feature1: 'No email or password needed to upload',
    feature2: 'Generates instant shareable links in seconds',
    feature3: 'AES-256 encrypted security with auto-expiration',
  },
};

export default function SeoLandingPage({ pageKey }) {
  const data = LANDING_DATA[pageKey] || LANDING_DATA['airdrop-alternative'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <SeoHead
        customTitle={data.title}
        customDescription={data.metaDesc}
        customCanonical={`https://itransfer.iprudhvi.in/${pageKey}`}
      />
      
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl theme-btn-primary flex items-center justify-center shadow-md">
              <Send className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">iTransfer</span>
          </Link>

          <Link
            to="/"
            className="theme-btn-primary px-4 py-2 text-xs font-bold shadow-xs inline-flex items-center gap-1.5"
          >
            <span>Open Transfer App</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12">
        
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold theme-bg-light theme-text mb-3 border border-indigo-100 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" /> {data.h1}
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3">
            {data.h1}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            {data.subtitle}
          </p>
        </div>

        {/* Action Card */}
        <div className="custom-card p-8 sm:p-10 text-center max-w-xl mx-auto mb-12 border-2 border-indigo-500 shadow-xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl theme-btn-primary flex items-center justify-center mx-auto mb-4 shadow-md">
            <Send className="w-8 h-8 text-white" />
          </div>

          <h3 className="text-xl font-black text-slate-900 mb-2">Ready to Transfer?</h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
            Choose between direct device streaming, email delivery, or an instant download link.
          </p>

          <Link
            to="/"
            className="theme-btn-primary w-full py-4 text-sm font-bold shadow-md inline-flex items-center justify-center gap-2"
          >
            <span>Start Transferring on iTransfer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Core Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="custom-card p-6 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">{data.feature1}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Engineered for maximum reliability across mobile and desktop devices.</p>
          </div>

          <div className="custom-card p-6 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">{data.feature2}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Protected with auto-expiration and optional password encryption.</p>
          </div>

          <div className="custom-card p-6 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">{data.feature3}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Full original quality preserved with zero compression or downscaling.</p>
          </div>
        </div>

      </main>

      <Footer />

    </div>
  );
}
