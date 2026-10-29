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

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterPlan === 'all' || u.plan === filterPlan;
    return matchesSearch && matchesFilter;
  });

  return (
    <Portal>
    <div className="ds-modal-backdrop acct-modal-backdrop acct-ui">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-panel-title"
        className="ds-modal is-wide acct-admin"
      >
        <span className="acct-grabber" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6 border-b border-[var(--ds-line)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="ds-icon is-dark" aria-hidden="true"><Crown /></span>
            <div className="min-w-0">
              <h2 id="admin-panel-title" className="ds-modal-title !text-[1.2rem] flex flex-wrap items-center gap-2">
                Admin hub
                <span className="ds-badge ds-badge-dark">Admin only</span>
              </h2>
              <p className="acct-hint acct-truncate mt-0.5">Signed in as {user?.email || 'iprudhvichowdary@gmail.com'}</p>
            </div>
          </div>

          <div className="acct-head-actions">
            <button
              type="button"
              onClick={fetchAdminData}
              className="acct-iconbtn"
              title="Refresh data"
              aria-label="Refresh data"
              aria-busy={loading}
            >
              <RefreshCw aria-hidden="true" />
            </button>
            <button type="button" onClick={onClose} className="acct-iconbtn" aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="acct-admin-scroll">
          {/* Top KPI Metrics Bar */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-4 sm:px-6">
            <div className="acct-stat">
              <dt><small>Users</small></dt>
              <dd><b>{totalUsers}</b></dd>
            </div>
            <div className="acct-stat">
              <dt><small>Pro</small></dt>
              <dd><b>{proUsers}</b></dd>
            </div>
            <div className="acct-stat">
              <dt><small>Free</small></dt>
              <dd><b>{freeUsers}</b></dd>
            </div>
            <div className="acct-stat">
              <dt><small>Free limit</small></dt>
              <dd><b>6 GB · 7 days</b></dd>
            </div>
          </dl>

          {/* Quick Grant Form */}
          <div className="px-5 pb-4 sm:px-6">
            <form onSubmit={handleAddNewUser} className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="ds-field flex-1 w-full">
                <label htmlFor="admin-grant-email" className="ds-label">Customer email</label>
                <input
                  id="admin-grant-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="client@agency.com"
                  className="ds-input"
                />
              </div>

              <div className="ds-field">
                <label htmlFor="admin-grant-plan" className="ds-label">Plan</label>
                <select
                  id="admin-grant-plan"
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="ds-select"
                >
                  <option value="pro">Pro</option>
                  <option value="free">Free</option>
                </select>
              </div>

              <button type="submit" className="ds-btn ds-btn-dark shrink-0">
                <PlusCircle className="w-4 h-4" aria-hidden="true" /> Save plan
              </button>
            </form>
          </div>

          {/* User Search & Filter */}
          <div className="px-5 py-3 sm:px-6 bg-[var(--ds-bg-soft)] border-y border-[var(--ds-line)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <label className="ds-input-wrap w-full sm:w-72">
              <Search aria-hidden="true" />
              <span className="acct-sr">Search users by email</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by email"
                className="ds-input"
              />
            </label>

            <div className="ds-tabs self-start sm:self-auto" role="group" aria-label="Filter by plan">
              {[
                ['all', `All (${totalUsers})`],
                ['pro', `Pro (${proUsers})`],
                ['free', `Free (${freeUsers})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="ds-tab"
                  aria-pressed={filterPlan === id}
                  onClick={() => setFilterPlan(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="px-5 py-4 sm:px-6">
            {loading ? (
              <div className="ds-empty" aria-busy="true">
                <span className="ds-spinner" aria-hidden="true" />
                <span className="text-sm font-semibold">Loading users…</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="ds-empty acct-empty">
                <span className="ds-icon" aria-hidden="true"><Users /></span>
                <h3>No users match your filter</h3>
              </div>
            ) : (
              <ul className="acct-rows">
                {filteredUsers.map((u) => {
                  const isProUser = u.plan === 'pro';
                  const isMasterAdmin = u.email === 'iprudhvichowdary@gmail.com';

                  return (
                    <li key={u.email} className="acct-admin-user">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-sm text-[var(--ds-ink)] acct-truncate" title={u.email}>{u.email}</span>
                          {isMasterAdmin ? (
                            <span className="ds-badge ds-badge-dark shrink-0">Admin</span>
                          ) : isProUser ? (
                            <span className="ds-badge ds-badge-blue shrink-0">
                              <Crown className="w-3 h-3" aria-hidden="true" /> Pro
                            </span>
                          ) : (
                            <span className="ds-badge shrink-0">Free</span>
                          )}
                        </div>

                        <p className="acct-meta flex items-center gap-2 flex-wrap">
                          <span>{u.uploadsCount} uploads ({formatBytes(u.totalBytes)})</span>
                          <span aria-hidden="true">·</span>
                          <span>Active {new Date(u.lastActive).toLocaleDateString()}</span>
                        </p>
                      </div>

                      {/* Action Buttons */}
                      {!isMasterAdmin && (
                        <button
                          type="button"
                          onClick={() => handleTogglePlan(u.email, u.plan)}
                          className={`ds-btn ds-btn-sm shrink-0 ${isProUser ? 'ds-btn-danger' : 'ds-btn-ghost'}`}
                        >
                          {isProUser ? <UserX className="w-4 h-4" aria-hidden="true" /> : <UserCheck className="w-4 h-4" aria-hidden="true" />}
                          <span>{isProUser ? 'Set to Free' : 'Set to Pro'}</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="ds-modal-foot flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--ds-muted)]">
          <span>Plan changes here are saved in this browser only.</span>
          <button type="button" onClick={onClose} className="ds-btn ds-btn-ghost ds-btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
