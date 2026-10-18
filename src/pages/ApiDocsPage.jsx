import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Code, Terminal, Copy, Check, Sparkles, Send,
  ShieldCheck, Server, Key, ArrowRight, Layers
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function ApiDocsPage() {
  const { addToast } = useToast();
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('curl'); // 'curl' | 'js' | 'python'
  const [copied, setCopied] = useState(false);

  const snippets = {
    curl: `# 1. Create a secure transfer link with auto-expiry
curl -X POST https://itransfer.iprudhvi.in/api/v1/transfers \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject": "Client Deliverables Q3",
    "expires_in_hours": 168,
    "password": "optional-secret-code",
    "notify_email": "sender@company.com"
  }'`,
    js: `// 1. Upload & Create Transfer using iTransfer Node/JS SDK
import { iTransferClient } from '@itransfer/sdk';

const client = new iTransferClient({ apiKey: 'YOUR_API_KEY' });

const transfer = await client.transfers.create({
  files: ['./video_master.mov', './render_assets.zip'],
  subject: '4K Master Files',
  expiresIn: '7d',
  password: 'secure-pin-code',
});

console.log('Shareable Link:', transfer.downloadUrl);`,
    python: `# 1. Programmatic Large File Transfer via Python
import itransfer

client = itransfer.Client(api_key="YOUR_API_KEY")

transfer = client.transfers.create(
    files=["./dataset.parquet", "./archive.tar.gz"],
    subject="ML Training Data",
    expires_in_days=7,
    password="super-secret-key"
)

print(f"Transfer Ready: {transfer.url}")`,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippets[selectedLang]);
      setCopied(true);
      addToast('Code sample copied! 📋', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      addToast('Copied! 📋', 'success');
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
<Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold theme-bg-light theme-text mb-3 border border-[#c4a574]/25/80 shadow-2xs">
            <Code className="w-3.5 h-3.5" /> Not available
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-white tracking-tight mb-3">
            There is no public API yet.
          </h1>
          <p className="text-sm sm:text-base text-white/55 font-medium leading-relaxed">
            The examples below are not a live service. There is no SDK, no API key, and no supported way to upload from another application.
          </p>
        </div>

        {/* Code Showcase Card */}
        <div className="custom-card p-6 bg-slate-900 text-white shadow-xl mb-12 border-slate-800">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg">
              {['curl', 'js', 'python'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    selectedLang === lang ? 'bg-[#c4a574] text-white shadow-2xs' : 'text-white/45 hover:text-white'
                  }`}
                >
                  {lang === 'curl' ? 'cURL' : lang === 'js' ? 'JavaScript / Node' : 'Python'}
                </button>
              ))}
            </div>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="p-2 text-xs font-mono text-indigo-300 overflow-x-auto leading-relaxed">
            <code>{snippets[selectedLang]}</code>
          </pre>
        </div>

        {/* REST API Endpoints Overview */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-white/45 uppercase tracking-wider">Core Endpoints</h3>

          <div className="space-y-2.5">
            <div className="custom-card p-4 bg-[#17192e] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono">POST</span>
                <span className="text-xs font-mono font-bold text-white">/api/v1/transfers</span>
                <span className="text-xs text-white/45">• Initialize a new chunked file transfer</span>
              </div>
              <span className="text-[11px] font-bold text-white/45">Resumable TUS Protocol</span>
            </div>

            <div className="custom-card p-4 bg-[#17192e] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono">GET</span>
                <span className="text-xs font-mono font-bold text-white">/api/v1/transfers/:id</span>
                <span className="text-xs text-white/45">• Fetch transfer metadata and download count</span>
              </div>
              <span className="text-[11px] font-bold text-white/45">Real-time status</span>
            </div>

            <div className="custom-card p-4 bg-[#17192e] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono">POST</span>
                <span className="text-xs font-mono font-bold text-white">/api/v1/requests</span>
                <span className="text-xs text-white/45">• Create an on-demand file drop portal</span>
              </div>
              <span className="text-[11px] font-bold text-white/45">Embeddable ready</span>
            </div>

            <div className="custom-card p-4 bg-[#17192e] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono">DELETE</span>
                <span className="text-xs font-mono font-bold text-white">/api/v1/transfers/:id</span>
                <span className="text-xs text-white/45">• Instantly purge files before expiration</span>
              </div>
              <span className="text-[11px] font-bold text-white/45">Zero residual data</span>
            </div>
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

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(u) => setUser(u)}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={async () => {
          await clearUserSession();
          setUser(null);
        }}
      />
    </div>
  );
}
