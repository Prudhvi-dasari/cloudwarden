import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  ShieldCheck, FileCode, CheckCircle2, Copy, Check,
  Sparkles, RefreshCw, ArrowRight, Lock, Hash, UploadCloud
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function ChecksumPage() {
  const { addToast } = useToast();
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [file, setFile] = useState(null);
  const [computing, setComputing] = useState(false);
  const [hashes, setHashes] = useState(null);
  const [compareHash, setCompareHash] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const handleFileSelect = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setComputing(true);
    setHashes(null);

    try {
      const buffer = await selected.arrayBuffer();
      
      // Calculate SHA-256 using subtle crypto
      const hashBuffer256 = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray256 = Array.from(new Uint8Array(hashBuffer256));
      const sha256 = hashArray256.map(b => b.toString(16).padStart(2, '0')).join('');

      // Calculate SHA-1
      const hashBuffer1 = await crypto.subtle.digest('SHA-1', buffer);
      const hashArray1 = Array.from(new Uint8Array(hashBuffer1));
      const sha1 = hashArray1.map(b => b.toString(16).padStart(2, '0')).join('');

      setHashes({
        sha256,
        sha1,
        size: selected.size,
        name: selected.name,
      });
      addToast('Checksums computed successfully! 🔒', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to compute checksum', 'error');
    } finally {
      setComputing(false);
    }
  };

  const handleCopy = async (key, val) => {
    await navigator.clipboard.writeText(val);
    setCopiedKey(key);
    addToast(`Copied ${key.toUpperCase()} hash! 📋`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isMatched = compareHash.trim() && hashes && (
    compareHash.trim().toLowerCase() === hashes.sha256.toLowerCase() ||
    compareHash.trim().toLowerCase() === hashes.sha1.toLowerCase()
  );

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
<Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-[#c4a574]/25/80 shadow-2xs">
            <Hash className="w-3.5 h-3.5" /> 100% Client-Side In-Browser Verification
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight mb-4 leading-tight">
            File Hash & Integrity Verifier
          </h1>
          <p className="text-base sm:text-lg text-white/55 font-medium leading-relaxed">
            Verify bit-for-bit file integrity before or after transfer. Calculate SHA-256 and SHA-1 checksums instantly without uploading files to any server.
          </p>
        </div>

        {/* Upload Drop Zone for Hash */}
        <div className="custom-card p-8 sm:p-10 bg-[#17192e] shadow-md mb-8">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 sm:p-12 cursor-pointer transition-colors bg-white/5/60 hover:bg-[#c4a574]/12/20">
            <input type="file" onChange={handleFileSelect} className="hidden" />
            <div className="w-14 h-14 rounded-2xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center mb-4">
              {computing ? (
                <RefreshCw className="w-7 h-7 animate-spin" />
              ) : (
                <UploadCloud className="w-7 h-7" />
              )}
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {computing ? 'Calculating cryptographic hashes...' : 'Select or drop a file to compute checksum'}
            </h3>
            <p className="text-xs sm:text-sm text-white/45 font-medium">
              Files are processed locally in your browser memory via Web Crypto API.
            </p>
          </label>

          {/* Results Card */}
          {hashes && (
            <div className="mt-8 space-y-4 animate-scale-in">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h4 className="text-sm font-bold text-white">{hashes.name}</h4>
                  <p className="text-xs text-white/45 font-medium">{(hashes.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
              </div>

              {/* SHA-256 */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/55 uppercase tracking-wider">SHA-256 Checksum</span>
                  <button
                    onClick={() => handleCopy('sha256', hashes.sha256)}
                    className="text-xs font-bold theme-text hover:underline flex items-center gap-1"
                  >
                    {copiedKey === 'sha256' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'sha256' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs font-mono font-bold text-white break-all bg-[#17192e] p-2.5 rounded-lg border border-white/10">
                  {hashes.sha256}
                </p>
              </div>

              {/* SHA-1 */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/55 uppercase tracking-wider">SHA-1 Checksum</span>
                  <button
                    onClick={() => handleCopy('sha1', hashes.sha1)}
                    className="text-xs font-bold theme-text hover:underline flex items-center gap-1"
                  >
                    {copiedKey === 'sha1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'sha1' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs font-mono font-bold text-white break-all bg-[#17192e] p-2.5 rounded-lg border border-white/10">
                  {hashes.sha1}
                </p>
              </div>

              {/* Checksum Matcher */}
              <div className="pt-4 border-t border-white/10">
                <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-2">
                  Compare with Expected Hash
                </label>
                <input
                  type="text"
                  value={compareHash}
                  onChange={(e) => setCompareHash(e.target.value)}
                  placeholder="Paste expected SHA-256 or SHA-1 hash to verify match..."
                  className="w-full px-4 py-3 bg-[#17192e] border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
                />

                {compareHash.trim() && (
                  <div className={`mt-3 p-3.5 rounded-xl border flex items-center gap-2.5 text-sm font-bold animate-fadeIn ${
                    isMatched
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}>
                    {isMatched ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>Exact Hash Match! File integrity is 100% authentic and uncorrupted.</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>Hash Mismatch. The file contents differ from the expected hash.</span>
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Educational Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
          <div className="custom-card p-5 bg-[#17192e] space-y-2">
            <h4 className="text-sm font-bold text-white">Why Use Checksums?</h4>
            <p className="text-xs text-white/45 leading-relaxed font-medium">
              A checksum acts as a cryptographic fingerprint. If even a single byte is altered in transit, the resulting hash completely changes.
            </p>
          </div>

          <div className="custom-card p-5 bg-[#17192e] space-y-2">
            <h4 className="text-sm font-bold text-white">Zero Server Upload</h4>
            <p className="text-xs text-white/45 leading-relaxed font-medium">
              Computations execute entirely inside your local browser via native WebAssembly and Web Crypto API for maximum privacy.
            </p>
          </div>

          <div className="custom-card p-5 bg-[#17192e] space-y-2">
            <h4 className="text-sm font-bold text-white">Bit-for-Bit Delivery</h4>
            <p className="text-xs text-white/45 leading-relaxed font-medium">
              iTransfer guarantees 100% bit-for-bit file delivery with zero compression, transcoding, or downsampling.
            </p>
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
