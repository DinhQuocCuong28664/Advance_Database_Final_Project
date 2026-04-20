import { useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/FlashContext';

const ACCOUNT_STATUSES = ['ACTIVE', 'LOCKED', 'DISABLED'];

export default function AdminAccounts({ accountSnapshot, setAccountSnapshot }) {
  const { setFlash } = useFlash();
  const [accountDrafts, setAccountDrafts] = useState(() => ({
    ...Object.fromEntries(accountSnapshot.system_users.map((u) => [`system-${u.user_id}`, u.account_status])),
    ...Object.fromEntries(accountSnapshot.guest_accounts.map((g) => [`guest-${g.guest_auth_id}`, g.account_status])),
  }));
  const [savingKey, setSavingKey] = useState('');

  async function handleSave(kind, account) {
    const key = `${kind}-${kind === 'system' ? account.user_id : account.guest_auth_id}`;
    const nextStatus = accountDrafts[key] || account.account_status;
    if (nextStatus === account.account_status) return;

    setSavingKey(key);
    try {
      const path =
        kind === 'system'
          ? `/admin/accounts/system/${account.user_id}`
          : `/admin/accounts/guest/${account.guest_auth_id}`;

      await apiRequest(path, {
        method: 'PUT',
        body: JSON.stringify({ account_status: nextStatus }),
      });

      setAccountSnapshot((cur) => ({
        system_users:
          kind === 'system'
            ? cur.system_users.map((u) => (u.user_id === account.user_id ? { ...u, account_status: nextStatus } : u))
            : cur.system_users,
        guest_accounts:
          kind === 'guest'
            ? cur.guest_accounts.map((g) =>
                g.guest_auth_id === account.guest_auth_id ? { ...g, account_status: nextStatus } : g,
              )
            : cur.guest_accounts,
      }));

      setAccountDrafts((cur) => ({ ...cur, [key]: nextStatus }));
      setFlash({
        tone: 'success',
        text: `${kind === 'system' ? account.full_name : account.login_email} updated to ${nextStatus}.`,
      });
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setSavingKey('');
    }
  }

  function renderRow(kind, account) {
    const id = kind === 'system' ? account.user_id : account.guest_auth_id;
    const key = `${kind}-${id}`;
    return (
      <article key={id} className="admin-account-row">
        <div>
          <strong>{account.full_name}</strong>
          <span>
            {kind === 'system'
              ? `${account.username} - ${account.department || 'N/A'}`
              : `${account.login_email} - ${account.guest_code}${account.tier_code ? ` - ${account.tier_code}` : ' - No loyalty tier'}`}
          </span>
        </div>
        <div className="admin-account-controls">
          <select
            value={accountDrafts[key] || account.account_status}
            onChange={(e) => setAccountDrafts((cur) => ({ ...cur, [key]: e.target.value }))}
            disabled={savingKey === key}
          >
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            className="ghost-button"
            disabled={savingKey === key || (accountDrafts[key] || account.account_status) === account.account_status}
            onClick={() => handleSave(kind, account)}
          >
            {savingKey === key ? 'Saving...' : 'Save'}
          </button>
        </div>
      </article>
    );
  }

  return (
    <section className="page-card page-card-wide">
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Account management</p>
          <h2>Admin and guest login snapshot</h2>
        </div>
        <span className="admin-status-pill">Live data</span>
      </div>

      <div className="admin-account-grid">
        <article className="admin-account-card admin-account-card-wide">
          <div className="admin-card-title">
            <h3>System users</h3>
            <span className="admin-status-pill">{accountSnapshot.system_users.length} users</span>
          </div>
          <div className="admin-account-list">
            {accountSnapshot.system_users.map((u) => renderRow('system', u))}
          </div>
        </article>

        <article className="admin-account-card admin-account-card-wide">
          <div className="admin-card-title">
            <h3>Guest login accounts</h3>
            <span className="admin-status-pill">{accountSnapshot.guest_accounts.length} accounts</span>
          </div>
          <div className="admin-account-list">
            {accountSnapshot.guest_accounts.map((g) => renderRow('guest', g))}
          </div>
        </article>
      </div>
    </section>
  );
}
