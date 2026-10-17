import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Code, Copy, Check, Sparkles, Inbox, Sliders, Palette,
  Eye, CheckCircle2, ShieldCheck, ArrowRight, ExternalLink,
  Layers, UploadCloud, Plus, Globe, Lock
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function WidgetPage() {
  const { addToast } = useToast();
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Widget Customization State
  const [widgetTitle, setWidgetTitle] = useState('Upload Your Project Files');
  const [widgetSubtitle, setWidgetSubtitle] = useState('Send high-resolution files directly to our team.');
  const [themeColor, setThemeColor] = useState('#4f46e5');
  const [showSenderName, setShowSenderName] = useState(true);
  const [showSenderEmail, setShowSenderEmail] = useState(true);
  const [showMessageField, setShowMessageField] = useState(true);
  const [maxSizeGB, setMaxSizeGB] = useState(5);
  const [copiedCode, setCopiedCode] = useState(false);
  const [embedType, setEmbedType] = useState('iframe'); // 'iframe' | 'script'

  const embedCodeIframe = `<iframe
  src="https://itransfer.iprudhvi.in/receive?embed=true&color=${encodeURIComponent(themeColor)}&title=${encodeURIComponent(widgetTitle)}"
  width="100%"
  height="480"
  frameborder="0"
  style="border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05);"
  allow="clipboard-write"
></iframe>`;

  const embedCodeScript = `<div id="itransfer-drop-widget" data-title="${widgetTitle}" data-color="${themeColor}"></div>
<script src="https://itransfer.iprudhvi.in/widget.js" async></script>`;

  const activeCode = embedType === 'iframe' ? embedCodeIframe : embedCodeScript;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedCode(true);
      addToast('Embed snippet copied to clipboard! 📋', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      addToast('Code copied! 📋', 'success');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900 bg-dot-grid relative overflow-hidden">
      
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />

      <Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold theme-bg-light theme-text mb-3 border border-indigo-100/80 shadow-2xs">
            <Code className="w-3.5 h-3.5" /> Embeddable File Reception Widget
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2.5">
            Receive files directly on your website.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            Customize an embeddable file drop widget and integrate it into your site with a single line of HTML.
          </p>
        </div>

        {/* 2-Column Builder & Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Customizer Controls (5 cols) */}
          <div className="lg:col-span-5 custom-card p-6 bg-white/90 space-y-5 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sliders className="w-4 h-4 theme-text" />
              <h3 className="text-sm font-bold text-slate-900">Widget Configuration</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Widget Title</label>
                <input
                  type="text"
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subtitle / Instructions</label>
                <input
                  type="text"
                  value={widgetSubtitle}
                  onChange={(e) => setWidgetSubtitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Brand Accent Color</label>
                <div className="flex items-center gap-2">
                  {['#4f46e5', '#059669', '#7c3aed', '#e11d48', '#0891b2', '#0f172a'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setThemeColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        themeColor === c ? 'scale-115 border-slate-900' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 ml-1 p-0.5 bg-white"
                    title="Custom hex color"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="block font-bold text-slate-700">Form Fields</span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSenderName}
                    onChange={(e) => setShowSenderName(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-slate-700 font-medium">Require Sender Name</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSenderEmail}
                    onChange={(e) => setShowSenderEmail(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-slate-700 font-medium">Require Sender Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showMessageField}
                    onChange={(e) => setShowMessageField(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-slate-700 font-medium">Include Note / Instructions box</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Max Upload Limit</label>
                <select
                  value={maxSizeGB}
                  onChange={(e) => setMaxSizeGB(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-700"
                >
                  <option value={2}>2 GB per drop</option>
                  <option value={5}>5 GB per drop (Standard)</option>
                  <option value={25}>25 GB per drop (Pro)</option>
                </select>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview & Embed Code (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Live Interactive Preview Box */}
            <div className="custom-card p-6 bg-white/95 shadow-md border border-slate-200">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 theme-text" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Preview</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Interactive Simulator
                </span>
              </div>

              {/* Simulated Embedded Widget Container */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/60 shadow-2xs space-y-4">
                <div className="text-center space-y-1">
                  <h4 className="text-base font-black text-slate-900">{widgetTitle}</h4>
                  <p className="text-xs text-slate-500 font-medium">{widgetSubtitle}</p>
                </div>

                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all bg-white hover:bg-slate-50/80"
                  style={{ borderColor: themeColor }}
                >
                  <div
                    className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-2 text-white shadow-xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">Drag files here, or click to browse</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supports any format up to {maxSizeGB} GB</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {showSenderName && (
                    <input
                      type="text"
                      placeholder="Your Full Name"
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  )}
                  {showSenderEmail && (
                    <input
                      type="email"
                      placeholder="Your Email"
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  )}
                </div>

                {showMessageField && (
                  <textarea
                    rows={2}
                    placeholder="Add a message for the recipient..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs resize-none"
                  />
                )}

                <button
                  className="w-full py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: themeColor }}
                >
                  <span>Upload Files to Recipient</span>
                </button>
              </div>
            </div>

            {/* Generated Embed Code Card */}
            <div className="custom-card p-5 bg-white/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 theme-text" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Embed Code Snippet</h4>
                </div>

                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    onClick={() => setEmbedType('iframe')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      embedType === 'iframe' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    HTML iFrame
                  </button>
                  <button
                    onClick={() => setEmbedType('script')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      embedType === 'script' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    JS Widget
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-36">
                  <code>{activeCode}</code>
                </pre>
                <button
                  onClick={handleCopyCode}
                  className="absolute top-2 right-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Paste this code into WordPress, Webflow, React, HTML, or any CMS to embed the widget immediately.
              </p>
            </div>

          </div>

        </div>

      </main>

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
