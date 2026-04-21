import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';
import '../styles/Admin.css';

import AdminAccounts from './admin/AdminAccounts';
import AdminFrontDesk from './admin/AdminFrontDesk';
import AdminHousekeeping from './admin/AdminHousekeeping';
import AdminInventory from './admin/AdminInventory';
import AdminInvoice from './admin/AdminInvoice';
import AdminMaintenance from './admin/AdminMaintenance';
import AdminPromotions from './admin/AdminPromotions';
import AdminReports from './admin/AdminReports';

const ADMIN_TABS = [
  { key: 'frontdesk',   label: '🏨 Front Desk',    note: 'Arrivals, departures, transfers, and stay actions' },
  { key: 'inventory',   label: '📦 Inventory',      note: 'Room availability and status control' },
  { key: 'housekeeping',label: '🧹 Housekeeping',   note: 'Cleaning tasks, assignments, and room status' },
  { key: 'maintenance', label: '🔧 Maintenance',    note: 'Issue tracking, repairs, and room status' },
  { key: 'invoice',     label: '📄 Invoices',       note: 'Generate and issue guest invoices' },
  { key: 'promotions',  label: '🎁 Promotions',     note: 'Create and manage hotel promotions & offers' },
  { key: 'accounts',    label: '👤 Accounts',       note: 'System and guest login management' },
  { key: 'reports',     label: '📊 Reports',        note: 'KPIs, exports, and revenue analytics' },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const { isSystemUser, isAdminUser, authSession, logout } = useAuth();
  const { setFlash } = useFlash();

  const [hotels, setHotels] = useState([]);
  const [rateAlerts, setRateAlerts] = useState([]);
  const [accountSnapshot, setAccountSnapshot] = useState({ system_users: [], guest_accounts: [] });
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [activeTab, setActiveTab] = useState('frontdesk');

  const [reportSummary, setReportSummary] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // Not logged in → login
  if (!isSystemUser) {
    return <Navigate to="/login" replace state={{ nextUrl: '/admin' }} />;
  }
  // Logged in but not ADMIN → cashier portal
  if (!isAdminUser) {
    return <Navigate to="/cashier" replace />;
  }

  useEffect(() => {
    async function load() {
      setLoadingHotels(true);
      setLoadingReport(true);
      try {
        const [hotelsPayload, alertsPayload, accountsPayload, summaryPayload, revenuePayload] =
          await Promise.all([
            apiRequest('/hotels'),
            apiRequest('/admin/rates/alerts').catch(() => ({ data: [] })),
            apiRequest('/admin/accounts').catch(() => ({ data: { system_users: [], guest_accounts: [] } })),
            apiRequest('/admin/reports/summary').catch(() => ({ data: null })),
            apiRequest('/admin/reports/revenue').catch(() => ({ data: [] })),
          ]);

        setHotels(hotelsPayload.data || []);
        setRateAlerts(alertsPayload.data || []);
        setAccountSnapshot(accountsPayload.data || { system_users: [], guest_accounts: [] });
        setReportSummary(summaryPayload.data || null);
        setRevenueData(revenuePayload.data || []);
      } catch (err) {
        setFlash({ tone: 'error', text: err.message });
      } finally {
        setLoadingHotels(false);
        setLoadingReport(false);
      }
    }

    load();
  }, [setFlash]);

  function handleLogout() {
    logout();
    setFlash({ tone: 'success', text: 'Signed out.' });
    navigate('/');
  }

  return (
    <div className="app-shell">
      <main className="page-stack">
        <section className="admin-hero">
          <div className="admin-hero-copy">
            <p className="page-eyebrow">Admin dashboard</p>
            <h1 className="page-title">Operations control for LuxeReserve.</h1>
            <p className="page-text">
              Welcome back, {authSession?.user?.full_name}. Use the tab bar below to switch between front desk,
              inventory, account management, and reports without scrolling through the entire admin stack.
            </p>
          </div>
          <div className="admin-hero-actions">
            <button className="primary-button" type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </section>

        <section className="admin-metrics">
          <article className="admin-metric-card">
            <span>Hotels loaded</span>
            <strong>{hotels.length || (loadingHotels ? '...' : '0')}</strong>
          </article>
          <article className="admin-metric-card">
            <span>Guest accounts</span>
            <strong>{accountSnapshot.guest_accounts.length}</strong>
          </article>
          <article className="admin-metric-card">
            <span>Open rate alerts</span>
            <strong>{rateAlerts.length}</strong>
          </article>
        </section>

        <section className="page-card page-card-wide">
          <div className="admin-tabs-head">
            <div>
              <p className="page-eyebrow">Modules</p>
              <h2>Admin workspace</h2>
            </div>
            <span className="admin-status-pill">
              {ADMIN_TABS.find((tab) => tab.key === activeTab)?.note}
            </span>
          </div>

          <div className="admin-tabs-bar" role="tablist" aria-label="Admin modules">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`admin-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === 'frontdesk'    ? <AdminFrontDesk hotels={hotels} /> : null}
        {activeTab === 'inventory'    ? <AdminInventory hotels={hotels} loadingHotels={loadingHotels} /> : null}
        {activeTab === 'housekeeping' ? <AdminHousekeeping hotels={hotels} /> : null}
        {activeTab === 'maintenance'  ? <AdminMaintenance hotels={hotels} /> : null}
        {activeTab === 'invoice'      ? <AdminInvoice hotels={hotels} /> : null}
        {activeTab === 'promotions'   ? <AdminPromotions hotels={hotels} /> : null}
        {activeTab === 'accounts' ? (
          <AdminAccounts accountSnapshot={accountSnapshot} setAccountSnapshot={setAccountSnapshot} />
        ) : null}
        {activeTab === 'reports' ? (
          <AdminReports reportSummary={reportSummary} revenueData={revenueData} loading={loadingReport} />
        ) : null}
      </main>
    </div>
  );
}
