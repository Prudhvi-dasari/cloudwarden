import { useState, useEffect } from 'react';
import {
  X, Crown, Users, DollarSign, HardDrive, ShieldCheck, Search,
  Check, RefreshCw, PlusCircle, Trash2, ArrowUpRight, UserCheck,
  UserX, Sparkles, Filter, Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import Portal from './Portal';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AdminPanelModal({ isOpen, onClose, user }) {
  const { addToast } = useToast();
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('all'); // 'all' | 'pro' | 'free'

  // Add User Form
  const [newEmail, setNewEmail] = useState('');
  const [newPlan, setNewPlan] = useState('pro');

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const summaryRes = await fetch('/api/r2?action=admin-summary', {
        headers: sessionWrap?.session?.access_token
          ? { Authorization: `Bearer ${sessionWrap.session.access_token}` }
          : {},
      });
      const summary = await summaryRes.json().catch(() => ({}));
      const transferRows = summaryRes.ok ? summary.uploaders : [];
      const error = summaryRes.ok ? null : new Error(summary.error || 'Summary unavailable');

      // Build consolidated user profiles
      const userMap = {};

      // Seed with known accounts and master admin
      userMap['iprudhvichowdary@gmail.com'] = {
        email: 'iprudhvichowdary@gmail.com',
        plan: 'pro',
        role: 'admin',
        uploadsCount: 0,
        totalBytes: 0,
        lastActive: new Date().toISOString(),
      };

      if (!error && transferRows) {
        transferRows.forEach((row) => {
          const em = (row.email || 'guest@itransfer.in').toLowerCase();
          if (!userMap[em]) {
            userMap[em] = {
              email: em,
              plan: em === 'iprudhvichowdary@gmail.com' ? 'pro' : 'free',
              role: em === 'iprudhvichowdary@gmail.com' ? 'admin' : 'user',
              uploadsCount: 0,
              totalBytes: 0,
              lastActive: row.lastActive,
            };
          }
          userMap[em].uploadsCount += row.uploadsCount || 0;
          userMap[em].totalBytes += row.totalBytes || 0;
        });
      }

      // Check locally persisted manual grants
      try {
        const manualGrants = JSON.parse(localStorage.getItem('itransfer_admin_pro_grants') || '{}');
        Object.entries(manualGrants).forEach(([em, plan]) => {
          const lower = em.toLowerCase();
          if (!userMap[lower]) {
            userMap[lower] = {
              email: lower,
              plan: plan,
              role: 'user',
              uploadsCount: 0,
              totalBytes: 0,
              lastActive: new Date().toISOString(),
            };
          } else {
            userMap[lower].plan = plan;
          }
        });
      } catch (e) {}

      setUsersList(Object.values(userMap));
    } catch (err) {
      console.warn('Admin fetch note:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlan = (targetEmail, currentPlan) => {
    const nextPlan = currentPlan === 'pro' ? 'free' : 'pro';
    
    // Save to local admin grants cache
    try {
      const grants = JSON.parse(localStorage.getItem('itransfer_admin_pro_grants') || '{}');
      grants[targetEmail.toLowerCase()] = nextPlan;
      localStorage.setItem('itransfer_admin_pro_grants', JSON.stringify(grants));
    } catch (e) {}

    // Update list state
    setUsersList(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        return { ...u, plan: nextPlan };
      }
      return u;
    }));

    addToast(`User ${targetEmail} updated to ${nextPlan.toUpperCase()}!`, 'success');
  };

  const handleAddNewUser = (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    const emailKey = newEmail.trim().toLowerCase();

    try {
      const grants = JSON.parse(localStorage.getItem('itransfer_admin_pro_grants') || '{}');
      grants[emailKey] = newPlan;
      localStorage.setItem('itransfer_admin_pro_grants', JSON.stringify(grants));
    } catch (e) {}

    setUsersList(prev => [
      {
        email: emailKey,
        plan: newPlan,
        role: 'user',
        uploadsCount: 0,
        totalBytes: 0,
        lastActive: new Date().toISOString(),
      },
      ...prev.filter(u => u.email.toLowerCase() !== emailKey),
    ]);

    setNewEmail('');
    addToast(`Granted ${newPlan.toUpperCase()} access to ${emailKey}! 👑`, 'success');
  };

  if (!isOpen) return null;

  const totalUsers = usersList.length;
  const proUsers = usersList.filter(u => u.plan === 'pro').length;
  const freeUsers = totalUsers - proUsers;
  const estimatedRevenue = (proUsers * 9.99).toFixed(2);

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterPlan === 'all' || u.plan === filterPlan;
    return matchesSearch && matchesFilter;
  });

  return (
    <Portal>
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Crown className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                iTransfer Master Admin Hub
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black">
                  ADMIN ONLY
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">Logged in as {user?.email || 'iprudhvichowdary@gmail.com'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAdminData}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-6 bg-slate-50 border-b border-slate-200">
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Users</span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{totalUsers}</p>
          </div>

          <div className="p-3.5 bg-white border border-amber-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Crown className="w-3 h-3 fill-amber-500 text-amber-500" /> PRO Members
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{proUsers}</p>
          </div>

          <div className="p-3.5 bg-white border border-emerald-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Est. Monthly Rev</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">${estimatedRevenue}</p>
          </div>

          <div className="p-3.5 bg-white border border-indigo-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Vault Storage</span>
            <p className="text-xl sm:text-2xl font-black text-indigo-900 mt-0.5">6 GB / 7 days</p>
          </div>
        </div>

        {/* Quick Grant Form */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-200">
          <form onSubmit={handleAddNewUser} className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="flex-1 w-full relative">
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter customer email (e.g. client@agency.com)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none"
            >
              <option value="pro">👑 Grant PRO Plan</option>
              <option value="free">Free Plan</option>
            </select>

            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 theme-btn-primary text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> Grant Access
            </button>
          </form>
        </div>

        {/* User Search & Filter */}
        <div className="p-4 sm:px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by email..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => setFilterPlan('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterPlan === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({totalUsers})
            </button>
            <button
              onClick={() => setFilterPlan('pro')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterPlan === 'pro' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Pro ({proUsers})
            </button>
            <button
              onClick={() => setFilterPlan('free')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterPlan === 'free' ? 'bg-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Free ({freeUsers})
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin theme-text" />
              <span className="text-sm font-semibold">Loading user database...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Users className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No users match your filter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => {
                const isProUser = u.plan === 'pro';
                const isMasterAdmin = u.email === 'iprudhvichowdary@gmail.com';

                return (
                  <div
                    key={u.email}
                    className="p-3 sm:p-4 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 hover:border-indigo-200 transition-colors shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">{u.email}</span>
                        {isMasterAdmin ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                            MASTER ADMIN
                          </span>
                        ) : isProUser ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Crown className="w-3 h-3 fill-amber-500" /> PRO
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            FREE
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{u.uploadsCount} uploads ({formatBytes(u.totalBytes)})</span>
                        <span>•</span>
                        <span>Active: {new Date(u.lastActive).toLocaleDateString()}</span>
                      </p>
                    </div>

                    {/* Action Buttons */}
                    {!isMasterAdmin && (
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          onClick={() => handleTogglePlan(u.email, u.plan)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                            isProUser
                              ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                              : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {isProUser ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          <span>{isProUser ? 'Revoke to Free' : 'Grant PRO 👑'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Changes take effect immediately across all client sessions.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
