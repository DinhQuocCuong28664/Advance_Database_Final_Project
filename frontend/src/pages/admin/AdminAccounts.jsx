import { useState, useMemo } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

//  Constants 
const STATUS_CONFIG = {
  ACTIVE:   { label: 'Active',   icon: '', bg: 'var(--pay-captured-bg)', color: 'var(--kpi-active)', btn: 'Activate' },
  LOCKED:   { label: 'Locked',   icon: '', bg: 'var(--priority-high-bg)', color: 'var(--kpi-locked)', btn: 'Lock' },
  DISABLED: { label: 'Disabled', icon: '', bg: 'var(--priority-critical-bg)', color: 'var(--kpi-disabled)', btn: 'Disable' },
};

const TIER_CONFIG = {
  BLACK:    { bg: 'var(--tier-black-bg)', color: 'var(--tier-black-color)' },
  PLATINUM: { bg: 'var(--tier-platinum-bg)', color: 'var(--tier-platinum-color)' },
  GOLD:     { bg: 'var(--priority-high-bg)', color: 'var(--kpi-locked)' },
  SILVER:   { bg: 'var(--tier-silver-bg)', color: 'var(--tier-silver-color)' },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'Never';

//  StatusPill 
function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DISABLED;
  return (
    <span className="acct-status-pill" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

//  TierBadge 
function TierBadge({ tier }) {
  if (!tier) return null;
  const cfg = TIER_CONFIG[tier] || { bg: 'var(--tier-default-bg)', color: 'var(--tier-default-color)' };
  return (
    <span className="acct-tier-badge" style={{ background: cfg.bg, color: cfg.color }}>
      {tier}
    </span>
  );
}

//  Quick-action buttons 
function QuickActions({ current, onSet, busy, selfLock }) {
  return (
    <div className="acct-quick-actions">
      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
        <button
          key={status}
          title={selfLock && status !== 'ACTIVE' ? 'Cannot lock your own account' : cfg.btn}
          className={`acct-action-btn ${current === status ? 'acct-action-btn--active' : ''}`}
          style={current === status ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color } : {}}
          disabled={busy || current === status || (selfLock && status !== 'ACTIVE')}
          onClick={() => onSet(status)}
        >
          {cfg.icon} {cfg.btn}
        </button>
      ))}
    </div>
  );
}

//  System User Row 
function SystemUserRow({ user, onStatusChange, currentUserId }) {
  const [busy, setBusy] = useState(false);
  const { setFlash } = useFlash();
  const isSelf = String(user.user_id) === String(currentUserId);

  async function handleSet(newStatus) {
    setBusy(true);
    try {
      await apiRequest(`/admin/accounts/system/${user.user_id}`, {
        method: 'PUT',
        body: JSON.stringify({ account_status: newStatus }),
      });
      onStatusChange('system', user.user_id, newStatus);
      setFlash({ tone: 'success', text: `${user.full_name}  ${newStatus}` });
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`acct-row ${busy ? 'acct-row--busy' : ''}`}>
      <div className="acct-row-avatar acct-row-avatar--system">
        {user.full_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="acct-row-info">
        <div className="acct-row-name">
          {user.full_name}
          {isSelf && <span className="acct-self-badge">You</span>}
        </div>
        <div className="acct-row-meta">
          <span>@{user.username}</span>
          {user.role_code && <span> {user.role_code}</span>}
          {user.department && <span> {user.department}</span>}
          {user.email && <span> {user.email}</span>}
        </div>
        <div className="acct-row-foot">
          <StatusPill status={user.account_status} />
          <span className="acct-last-login">Last login: {fmtDate(user.last_login_at)}</span>
        </div>
      </div>
      <QuickActions
        current={user.account_status}
        onSet={handleSet}
        busy={busy}
        selfLock={isSelf}
      />
    </div>
  );
}

//  Guest Account Row 
function GuestRow({ guest, onStatusChange }) {
  const [busy, setBusy] = useState(false);
  const { setFlash } = useFlash();

  async function handleSet(newStatus) {
    setBusy(true);
    try {
      await apiRequest(`/admin/accounts/guest/${guest.guest_auth_id}`, {
        method: 'PUT',
        body: JSON.stringify({ account_status: newStatus }),
      });
      onStatusChange('guest', guest.guest_auth_id, newStatus);
      setFlash({ tone: 'success', text: `${guest.login_email}  ${newStatus}` });
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`acct-row ${busy ? 'acct-row--busy' : ''}`}>
      <div className="acct-row-avatar acct-row-avatar--guest">
        {guest.full_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="acct-row-info">
        <div className="acct-row-name">
          {guest.full_name}
          {guest.vip_flag === true && <span className="acct-vip-badge"> VIP</span>}
          <TierBadge tier={guest.tier_code} />
        </div>
        <div className="acct-row-meta">
          <span>{guest.login_email}</span>
          <span> {guest.guest_code}</span>
          {guest.points_balance != null && (
            <span> {Number(guest.points_balance).toLocaleString()} pts</span>
          )}
        </div>
        <div className="acct-row-foot">
          <StatusPill status={guest.account_status} />
          <span className="acct-last-login">Last login: {fmtDate(guest.last_login_at)}</span>
        </div>
      </div>
      <QuickActions current={guest.account_status} onSet={handleSet} busy={busy} />
    </div>
  );
}

//  Main AdminAccounts 
export default function AdminAccounts({ accountSnapshot, setAccountSnapshot }) {
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [activeSection, setActiveSection] = useState('system'); // 'system' | 'guest'

  // Get current user ID from JWT for self-lock guard
  const currentUserId = useMemo(() => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub;
    } catch { return null; }
  }, []);

  function handleStatusChange(kind, id, newStatus) {
    setAccountSnapshot(cur => ({
      system_users: kind === 'system'
        ? cur.system_users.map(u => u.user_id === id ? { ...u, account_status: newStatus } : u)
        : cur.system_users,
      guest_accounts: kind === 'guest'
        ? cur.guest_accounts.map(g => g.guest_auth_id === id ? { ...g, account_status: newStatus } : g)
        : cur.guest_accounts,
    }));
  }

  // Derived filtered lists
  const sysUsers = useMemo(() => {
    let list = accountSnapshot.system_users || [];
    if (filterStatus !== 'ALL') list = list.filter(u => u.account_status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    return list;
  }, [accountSnapshot.system_users, search, filterStatus]);

  const guestAccounts = useMemo(() => {
    let list = accountSnapshot.guest_accounts || [];
    if (filterStatus !== 'ALL') list = list.filter(g => g.account_status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(g => g.full_name?.toLowerCase().includes(q) || g.login_email?.toLowerCase().includes(q) || g.guest_code?.toLowerCase().includes(q));
    }
    return list;
  }, [accountSnapshot.guest_accounts, search, filterStatus]);

  // KPI counts
  const totalSys   = accountSnapshot.system_users?.length || 0;
  const activeSys  = accountSnapshot.system_users?.filter(u => u.account_status === 'ACTIVE').length || 0;
  const totalGuest = accountSnapshot.guest_accounts?.length || 0;
  const activeGuest = accountSnapshot.guest_accounts?.filter(g => g.account_status === 'ACTIVE').length || 0;
  const lockedAll  = [...(accountSnapshot.system_users || []), ...(accountSnapshot.guest_accounts || [])].filter(a => a.account_status === 'LOCKED').length;
  const disabledAll = [...(accountSnapshot.system_users || []), ...(accountSnapshot.guest_accounts || [])].filter(a => a.account_status === 'DISABLED').length;

  const activeList = activeSection === 'system' ? sysUsers : guestAccounts;
  const activeKind = activeSection === 'system' ? 'system' : 'guest';

  return (
    <section className="page-card page-card-wide" id="admin-accounts">
      {/*  Header  */}
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Access Control</p>
          <h2 className="page-title">Account Management</h2>
          <p className="page-sub">Manage login access for system staff and registered guests.</p>
        </div>
      </div>

      {/*  KPI Strip  */}
      <div className="acct-kpi-strip">
        <div className="acct-kpi">
          <span className="acct-kpi-num">{totalSys}</span>
          <span className="acct-kpi-label">Staff Accounts</span>
        </div>
        <div className="acct-kpi">
          <span className="acct-kpi-num" style={{ color: 'var(--kpi-active)' }}>{activeSys}</span>
          <span className="acct-kpi-label">Staff Active</span>
        </div>
        <div className="acct-kpi" style={{ borderLeft: '1px solid var(--admin-table-border)', paddingLeft: 24 }}>
          <span className="acct-kpi-num">{totalGuest}</span>
          <span className="acct-kpi-label">Guest Accounts</span>
        </div>
        <div className="acct-kpi">
          <span className="acct-kpi-num" style={{ color: 'var(--kpi-active)' }}>{activeGuest}</span>
          <span className="acct-kpi-label">Guests Active</span>
        </div>
        {lockedAll > 0 && (
          <div className="acct-kpi">
            <span className="acct-kpi-num" style={{ color: 'var(--kpi-locked)' }}>{lockedAll}</span>
            <span className="acct-kpi-label">Locked</span>
          </div>
        )}
        {disabledAll > 0 && (
          <div className="acct-kpi">
            <span className="acct-kpi-num" style={{ color: 'var(--kpi-disabled)' }}>{disabledAll}</span>
            <span className="acct-kpi-label">Disabled</span>
          </div>
        )}
      </div>

      {/*  Section Toggle + Filters  */}
      <div className="acct-toolbar">
        <div className="acct-section-toggle">
          <button
            className={activeSection === 'system' ? 'primary-button' : 'ghost-button'}
            onClick={() => setActiveSection('system')}
          >
             Staff ({totalSys})
          </button>
          <button
            className={activeSection === 'guest' ? 'primary-button' : 'ghost-button'}
            onClick={() => setActiveSection('guest')}
          >
             Guests ({totalGuest})
          </button>
        </div>

        <div className="acct-filters">
          <input
            className="fd-input"
            type="search"
            placeholder={`Search ${activeSection === 'system' ? 'name, username, email...' : 'name, email, guest code...'}`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <select className="fd-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active only</option>
            <option value="LOCKED">Locked only</option>
            <option value="DISABLED">Disabled only</option>
          </select>
        </div>
      </div>

      {/*  Account List  */}
      <div className="acct-list">
        {activeList.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>
            No accounts match your search.
          </p>
        ) : (
          activeList.map(account => (
            activeKind === 'system'
              ? <SystemUserRow
                  key={account.user_id}
                  user={account}
                  onStatusChange={handleStatusChange}
                  currentUserId={currentUserId}
                />
              : <GuestRow
                  key={account.guest_auth_id}
                  guest={account}
                  onStatusChange={handleStatusChange}
                />
          ))
        )}
      </div>

      <p style={{ fontSize: '0.74rem', color: 'var(--text-soft)', marginTop: 16, textAlign: 'right' }}>
        {activeList.length} of {activeSection === 'system' ? totalSys : totalGuest} accounts shown
        {'  '}Data loaded at admin session start  refresh browser to update.
      </p>
    </section>
  );
}
