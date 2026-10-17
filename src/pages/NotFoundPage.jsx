import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Send, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-16 text-center flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h1 className="text-3xl font-black text-slate-900 mb-2">404 - Page Not Found</h1>
        <p className="text-sm text-slate-500 mb-6">
          The page or transfer link you requested does not exist or may have expired.
        </p>

        <Link to="/" className="theme-btn-primary px-6 py-3 text-xs font-bold shadow-md flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Go to iTransfer Homepage
        </Link>
      </main>

      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 iTransfer. Fast, secure & private file sharing.</span>
          <span className="font-medium text-slate-700">Made in India with ❤️ and lots of ☕️</span>
        </div>
      </footer>
    </div>
  );
}
