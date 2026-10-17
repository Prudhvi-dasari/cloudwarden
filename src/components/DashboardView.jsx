import { useState, useEffect } from 'react';
import { supabase, publicSupabase } from '../lib/supabase';
import { activeStorageProvider } from '../lib/storageProvider';
import {
  Download, Trash2, Copy, Check, Clock, Lock, ExternalLink,
  Loader2, HardDrive, RefreshCw, Send, Inbox, ShieldCheck,
  Flame, PlusCircle, Sparkles, Filter, Search, Users, UserPlus,
  Settings, Volume2, VolumeX, BarChart2, CheckCircle2, ChevronRight,
  Share2, Mail, FileText, ArrowRight, Eye, Code, Link2
} from 'lucide-react';
import { isSoundEnabled, setSoundEnabled, playSuccessChime } from '../lib/sound';
import { useToast } from './Toast';
import { getGuestTransferIds } from '../lib/guestSession';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DashboardView({ user }) {
  const { addToast } = useToast();

  // Navigation State: 'overview' | 'transfers' | 'requests' | 'contacts' | 'storage' | 'settings'
  const [sidebarTab, setSidebarTab] = useState('overview');

  // Transfers Data State
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [transferFilter, setTransferFilter] = useState('all'); // 'all' | 'active' | 'sent' | 'received' | 'expired'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [soundEnabled, setSoundEnabledState] = useState(() => isSoundEnabled());

  // File Request Generator State
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [newRequestUrl, setNewRequestUrl] = useState('');

  // Contacts / Address Book State (Saved locally & in Supabase metadata)
  const [contacts, setContacts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('itransfer_contacts') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (e) {
      return [];
    }
  });
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactGroup, setNewContactGroup] = useState('Clients');

  useEffect(() => {
    setSoundEnabledState(isSoundEnabled());
    loadUserTransfers();

    // Supabase Realtime Channel for live file and transfer updates
    const channel = supabase
      .channel('realtime:transfers_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transfers' },
        (payload) => {
          // Immediately reload transfers on real-time insert, update, or delete
          loadUserTransfers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function loadUserTransfers() {
    if (!user) {
      setTransfers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const isUidValid = user.id && isValidUUID(user.id);

      let query = publicSupabase.from('transfers').select('*');
      if (isUidValid && user.email) {
        query = query.or(`user_id.eq.${user.id},sender_email.eq.${user.email}`);
      } else if (user.email) {
        query = query.eq('sender_email', user.email);
      } else if (isUidValid) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
      if (error) throw error;

      const allRows = data || [];

      // Group rows by share_id
      const grouped = {};
      allRows.forEach((row) => {
        if (!grouped[row.share_id]) {
          grouped[row.share_id] = {
            shareId: row.share_id,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            subject: row.subject,
            message: row.message,
            passwordHash: row.password_hash,
            transferType: row.transfer_type || 'link',
            senderEmail: row.sender_email,
            recipientEmails: row.recipient_emails,
            files: [],
            totalSize: 0,
            downloadCount: 0,
            maxDownloads: row.max_downloads || 0,
          };
        }
        grouped[row.share_id].files.push({
          id: row.id,
          name: row.file_name,
          size: row.file_size,
          path: row.file_path,
          type: row.content_type,
          downloadCount: row.download_count || 0,
        });
        grouped[row.share_id].totalSize += row.file_size || 0;
        grouped[row.share_id].downloadCount += row.download_count || 0;
      });

      setTransfers(Object.values(grouped));
    } catch (err) {
      console.error('Error loading transfers:', err);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyLink = async (shareId) => {
    const url = `${window.location.origin}/download/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(shareId);
      addToast('Transfer link copied! 📋', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      addToast('Link copied! 📋', 'success');
    }
  };

  const handleDeleteTransfer = async (t) => {
    if (!confirm('Are you sure you want to delete this transfer? Files will be permanently removed.')) return;
    try {
      for (const f of t.files) {
        if (f.path) {
          await activeStorageProvider.deleteFile(f.path);
        }
      }
      await supabase.from('transfers').delete().eq('share_id', t.shareId);
      setTransfers(prev => prev.filter(item => item.shareId !== t.shareId));
      if (selectedTransfer?.shareId === t.shareId) setSelectedTransfer(null);
      addToast('Transfer permanently deleted 🗑️', 'info');
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleCreateRequest = () => {
    const reqId = (requestName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') || 'general') + '-' + Math.random().toString(36).substring(2, 6);
    const url = `${window.location.origin}/request/${reqId}`;
    setNewRequestUrl(url);
    setIsCreatingRequest(true);
    addToast('File request portal link created! 📥', 'success');
  };

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newContactEmail.trim()) return;
    const newEntry = {
      id: Date.now(),
      name: newContactName.trim() || newContactEmail.trim(),
      email: newContactEmail.trim(),
      group: newContactGroup,
    };
    const updated = [newEntry, ...contacts];
    setContacts(updated);
    localStorage.setItem('itransfer_contacts', JSON.stringify(updated));
    setNewContactName('');
    setNewContactEmail('');
    addToast('Contact added to address book! 👤', 'success');
  };

  const handleDeleteContact = (id) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    localStorage.setItem('itransfer_contacts', JSON.stringify(updated));
    addToast('Contact removed', 'info');
  };

  const handleToggleSoundSetting = (val) => {
    setSoundEnabledState(val);
    setSoundEnabled(val);
    if (val) playSuccessChime();
    addToast(val ? 'Sound effects enabled 🔔' : 'Sound effects muted 🔕', 'info');
  };

  // Metrics computation
  const now = new Date();
  const activeList = transfers.filter(t => new Date(t.expiresAt) > now);
  const expiredList = transfers.filter(t => new Date(t.expiresAt) <= now);
  const totalSentBytes = transfers.reduce((acc, t) => acc + t.totalSize, 0);
  const totalDownloads = transfers.reduce((acc, t) => acc + t.downloadCount, 0);

  // Filter transfers for the Transfer tab
  const filteredTransfers = transfers.filter(t => {
    const isExpired = new Date(t.expiresAt) <= now;
    if (transferFilter === 'active' && isExpired) return false;
    if (transferFilter === 'expired' && !isExpired) return false;
    if (transferFilter === 'sent' && t.transferType !== 'email') return false;
    if (transferFilter === 'received' && t.transferType !== 'request') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubject = t.subject?.toLowerCase().includes(q);
      const matchRec = t.recipientEmails?.toLowerCase().includes(q);
      const matchFile = t.files.some(f => f.name.toLowerCase().includes(q));
      if (!matchSubject && !matchRec && !matchFile) return false;
    }
    return true;
  });

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-14 p-8 bg-white border border-slate-200/90 rounded-3xl text-center space-y-4 shadow-sm animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Sign In to View Dashboard</h2>
        <p className="text-sm text-slate-600 font-medium">
          Only logged-in members can access the transfers management dashboard and cloud vault.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: 'login' }))}
          className="w-full py-2.5 theme-btn-primary text-white font-bold text-sm rounded-xl shadow-xs cursor-pointer"
        >
          Sign In to Your Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Transfer Dashboard</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Pro Ready
            </span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage your active transfers, download tracking, file requests, and contacts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadUserTransfers}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold shadow-2xs flex items-center gap-2 transition-colors"
            title="Refresh Transfers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar Tabs + Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-1.5 bg-white/80 p-3 rounded-2xl border border-slate-200 shadow-2xs h-fit">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart2 },
            { id: 'transfers', name: 'Transfers', icon: Send, badge: transfers.length },
            { id: 'requests', name: 'File Requests', icon: Inbox },
            { id: 'contacts', name: 'Contacts', icon: Users, badge: contacts.length },
            { id: 'storage', name: 'Storage', icon: HardDrive },
            { id: 'settings', name: 'Preferences', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setSidebarTab(tab.id); setSelectedTransfer(null); }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold transition-all ${
                  sidebarTab === tab.id
                    ? 'theme-btn-primary shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </div>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    sidebarTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {sidebarTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="custom-card p-4 sm:p-5 space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">{activeList.length}</p>
                  <span className="text-xs text-emerald-600 font-bold">Available now</span>
                </div>

                <div className="custom-card p-4 sm:p-5 space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Downloads</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalDownloads}</p>
                  <span className="text-xs text-slate-500 font-bold">Total tracked</span>
                </div>

                <div className="custom-card p-4 sm:p-5 space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sent</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">{formatBytes(totalSentBytes)}</p>
                  <span className="text-xs text-indigo-600 font-bold">{transfers.length} transfers</span>
                </div>

                <div className="custom-card p-4 sm:p-5 space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Storage</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">{formatBytes(totalSentBytes)}</p>
                  <span className="text-xs text-slate-500 font-bold">of 1 TB (HDD/Cloud)</span>
                </div>
              </div>

              {/* Recent Transfers Quick List */}
              <div className="custom-card p-5 bg-white/90">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Transfers</h3>
                  <button
                    onClick={() => setSidebarTab('transfers')}
                    className="text-xs font-bold theme-text hover:underline flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {transfers.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No transfers yet. Send your first file above!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transfers.slice(0, 4).map((t) => (
                      <div
                        key={t.shareId}
                        onClick={() => setSelectedTransfer(t)}
                        className="p-3 bg-slate-50/70 hover:bg-slate-100/80 rounded-xl border border-slate-200/70 flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            {t.transferType === 'email' ? <Mail className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {t.subject || t.files[0]?.name || 'Untitled Transfer'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {t.files.length} file{t.files.length !== 1 ? 's' : ''} • {formatBytes(t.totalSize)} • {t.downloadCount} download{t.downloadCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyLink(t.shareId); }}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                            title="Copy link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: TRANSFERS MANAGEMENT */}
          {sidebarTab === 'transfers' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, recipient, or filename..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  {['all', 'active', 'sent', 'expired'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setTransferFilter(f)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                        transferFilter === f ? 'theme-btn-primary shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transfers List */}
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin theme-text" />
                  <span>Loading transfers...</span>
                </div>
              ) : filteredTransfers.length === 0 ? (
                <div className="custom-card p-8 text-center text-slate-400 text-xs">
                  No transfers found matching your filter.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTransfers.map((t) => {
                    const isExpired = new Date(t.expiresAt) <= now;
                    return (
                      <div
                        key={t.shareId}
                        className={`custom-card p-4 space-y-3 bg-white/90 transition-all ${
                          isExpired ? 'opacity-70 bg-slate-50/70' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isExpired ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600'
                            }`}>
                              {t.transferType === 'email' ? <Mail className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {t.subject || t.files[0]?.name || 'Untitled Transfer'}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {t.files.length} file{t.files.length !== 1 ? 's' : ''} • {formatBytes(t.totalSize)} • {new Date(t.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            <button
                              onClick={() => handleCopyLink(t.shareId)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              {copiedId === t.shareId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === t.shareId ? 'Copied' : 'Copy Link'}</span>
                            </button>

                            <a
                              href={`/download/${t.shareId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors"
                              title="Open Download Page"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            <button
                              onClick={() => handleDeleteTransfer(t)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs transition-colors"
                              title="Delete Transfer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Status bar */}
                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 font-medium text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {isExpired ? 'Expired' : `Expires ${new Date(t.expiresAt).toLocaleDateString()}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {t.downloadCount} download{t.downloadCount !== 1 ? 's' : ''}
                          </span>
                          {t.passwordHash && (
                            <span className="flex items-center gap-1 text-amber-600 font-semibold">
                              <Lock className="w-3 h-3" /> Password Protected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 3: FILE REQUESTS / DROP LINKS */}
          {sidebarTab === 'requests' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="custom-card p-5 bg-white/90 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Generate File Request Portal</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Let clients or colleagues send files directly to your storage without signing up.</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    placeholder="Portal Name (e.g. Client-Assets-2026)"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleCreateRequest}
                    className="theme-btn-primary px-4 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Create Portal</span>
                  </button>
                </div>

                {newRequestUrl && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2 animate-fadeIn">
                    <p className="text-xs font-bold text-indigo-900">Your Shareable Request Link:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={newRequestUrl}
                        className="flex-1 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono text-slate-800"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(newRequestUrl);
                          addToast('Request link copied! 📥', 'success');
                        }}
                        className="theme-btn-primary px-3 py-1.5 text-xs font-bold"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CONTACTS / ADDRESS BOOK */}
          {sidebarTab === 'contacts' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Add Contact Form */}
              <form onSubmit={handleAddContact} className="custom-card p-4 bg-white/90 space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Add Saved Contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Contact Name"
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="email"
                    required
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="Email Address"
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newContactGroup}
                      onChange={(e) => setNewContactGroup(e.target.value)}
                      className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700"
                    >
                      <option value="Clients">Clients</option>
                      <option value="Team">Team</option>
                      <option value="Friends">Friends</option>
                      <option value="Family">Family</option>
                    </select>
                    <button
                      type="submit"
                      className="theme-btn-primary px-3 py-1.5 text-xs font-bold shadow-2xs flex-1"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </form>

              {/* Contacts List */}
              <div className="custom-card p-4 bg-white/90">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Address Book ({contacts.length})
                </h3>

                {contacts.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    No saved contacts. Add frequent recipients above for instant sending!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{c.name}</p>
                          <p className="text-[11px] text-slate-500">{c.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {c.group}
                          </span>
                          <button
                            onClick={() => handleDeleteContact(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Remove contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: STORAGE */}
          {sidebarTab === 'storage' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="custom-card p-5 bg-white/90 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Storage Allocation</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-600">Total Used:</span>
                    <span className="text-slate-900 font-bold">{formatBytes(totalSentBytes)} / 1.0 TB</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full theme-btn-primary"
                      style={{ width: `${Math.min(100, Math.max(1, (totalSentBytes / (1024 * 1024 * 1024 * 1024)) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <p className="text-slate-500 font-medium">Active Storage</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatBytes(totalSentBytes)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <p className="text-slate-500 font-medium">Provider</p>
                    <p className="text-sm font-black text-indigo-600 mt-0.5">Cloud + HDD</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <p className="text-slate-500 font-medium">Auto-Cleanup</p>
                    <p className="text-sm font-black text-emerald-600 mt-0.5">Enabled</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {sidebarTab === 'settings' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="custom-card p-5 bg-white/90 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Preferences & Notifications</h3>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <div>
                      <p className="font-bold text-slate-900">Sound Effects</p>
                      <p className="text-slate-500 text-[11px]">Play chime when uploads and downloads complete.</p>
                    </div>
                    <button
                      onClick={() => handleToggleSoundSetting(!soundEnabled)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                        soundEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {soundEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <div>
                      <p className="font-bold text-slate-900">Email Delivery Receipts</p>
                      <p className="text-slate-500 text-[11px]">Receive notification when a recipient downloads your files.</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
