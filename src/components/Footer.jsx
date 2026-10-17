import { Link } from 'react-router-dom';
import { Send, ShieldCheck, Lock, ArrowUpRight } from 'lucide-react';
import { getStoredUser, isUserPro } from '../lib/authSession';

export default function Footer() {
  const user = getStoredUser();
  const isPro = isUserPro(user);

  return (
    <footer className="border-t border-slate-200/80 bg-white/95 backdrop-blur-xl text-slate-500 text-xs sm:text-sm z-10 relative select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        
        {/* Main Clean Row: Brand + Essential Links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-200/60 text-center md:text-left">
          
          {/* Brand Logo & Slogan */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <div className="w-8 h-8 rounded-xl theme-btn-primary flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                <Send className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors font-sans">
                iTransfer
              </span>
            </Link>
            <span className="hidden sm:inline text-slate-300">•</span>
            <p className="text-xs text-slate-500 font-medium">
              Fast, encrypted file transfers up to 25 GB. Zero compression.
            </p>
          </div>

          {/* Essential Quick Nav Links */}
          <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm font-bold text-slate-600">
            <Link to="/features" className="hover:text-indigo-600 transition-colors">
              Features
            </Link>
            {!isPro && (
              <Link to="/pricing" className="hover:text-indigo-600 transition-colors">
                Pricing
              </Link>
            )}
            <Link to="/security" className="hover:text-indigo-600 transition-colors">
              Security
            </Link>
            <Link to="/terms" className="hover:text-indigo-600 transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-indigo-600 transition-colors">
              Privacy
            </Link>
            <Link to="/help" className="hover:text-indigo-600 transition-colors">
              Help
            </Link>
          </nav>

        </div>

        {/* Minimal Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-medium text-center sm:text-left">
          <div>
            © 2026 <span className="text-slate-600 font-semibold">iTransfer</span>. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/status" className="text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Systems Online</span>
            </Link>
            <span>•</span>
            <span className="text-slate-500 font-medium">Made in India with ❤️ and lots of ☕️</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
