import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/useFlash';
import '../styles/Admin.css';

import AdminAccounts from './admin/AdminAccounts';
import AdminFrontDesk from './admin/AdminFrontDesk';
import AdminHousekeeping from './admin/AdminHousekeeping';
import AdminInventory from './admin/AdminInventory';
import AdminInvoice from './admin/AdminInvoice';
import AdminMaintenance from './admin/AdminMaintenance';
import AdminPromotions from './admin/AdminPromotions';
import AdminPayments from './admin/AdminPayments';
import AdminRates from './admin/AdminRates';
import AdminTimeline from './admin/AdminTimeline';
import AdminLocationChannels from './admin/AdminLocationChannels';
import AdminReports from './admin/AdminReports';
import ToastContainer from '../components/layout/ToastContainer';

const ADMIN_TABS = [
  { key: 'frontdesk', label: '🏨 Front Desk', note: 'Arrivals, departures, transfers, and stay actions' },
  { key: 'inventory', label: '⚙️ Inventory', note: 'Room availability and status control' },
  { key: 'housekeeping', label: '🧹 Housekeeping', note: 'Cleaning tasks, assignments, and room status' },
  { key: 'maintenance', label: '🔧 Maintenance', note: 'Issue tracking, repairs, and room status' },
  { key: 'invoice', label: '📋 Invoices', note: 'Generate and issue guest invoices' },
  { key: 'rates', label: '💰 Rates', note: 'Manage nightly room rates with Price Guard protection' },
  { key: 'promotions', label: '🎁 Promotions', note: 'Create and manage hotel promotions and offers' },
  { key: 'channels', label: '🌐 Channels', note: 'Booking channel stats and location hierarchy tree' },
  { key: 'payments', label: '💳 Payments', note: 'Payment history, filters and transaction review' },
  { key: 'accounts', label: '👤 Accounts', note: 'System and guest login management' },
  { key: 'timeline', label: '🕒 Timeline', note: 'Reservation status audit trail and history' },
  { key: 'reports', label: '📊 Reports', note: 'KPIs, exports, and revenue analytics' },
];

const MANAGER_TABS = [
  { key: 'rates', label: '💰 Rates', note: 'Manage nightly room rates with Price Guard protection' },
  { key: 'reports', label: '📊 Reports', note: 'KPIs, exports, and revenue analytics' },
];

export default function AdminPage() {
  const navigate = useNavigate();
<<<<<<< Updated upstream
  const { isSystemUser, isAdminUser, isManagerUser, authSession, logout } = useAuth();
  const { setFlash, clearToasts } = useFlash();

  const availableTabs = useMemo(
    () => (isAdminUser ? ADMIN_TABS : MANAGER_TABS),
    [isAdminUser]
  );

=======
<<<<<<< Updated upstream
  const { isSystemUser, isAdminUser, authSession, logout } = useAuth();
  const { setFlash, clearToasts } = useFlash();

=======
  const { isSystemUser, isAdminUser, isManagerUser, isFrontDeskUser, isCashierUser, isHkManagerUser, authSession, logout } = useAuth();
  const { setFlash, clearToasts } = useFlash();

  const availableTabs = useMemo(() => {
    const tabs = [];
    if (isAdminUser) return ADMIN_TABS;
    
    if (isManagerUser) tabs.push(...MANAGER_TABS, ...ADMIN_TABS.filter(t => ['frontdesk', 'inventory', 'housekeeping', 'invoice', 'payments', 'timeline'].includes(t.key)));
    if (isFrontDeskUser) tabs.push(...ADMIN_TABS.filter(t => ['frontdesk', 'inventory', 'housekeeping', 'invoice'].includes(t.key)));
    if (isCashierUser) tabs.push(...ADMIN_TABS.filter(t => ['invoice', 'payments', 'frontdesk'].includes(t.key)));
    if (isHkManagerUser) tabs.push(...ADMIN_TABS.filter(t => ['housekeeping', 'maintenance'].includes(t.key)));

    // Deduplicate by key
    return tabs.filter((t, index, self) => index === self.findIndex((x) => x.key === t.key));
  }, [isAdminUser, isManagerUser, isFrontDeskUser, isCashierUser, isHkManagerUser]);

>>>>>>> Stashed changes
>>>>>>> Stashed changes
  const [hotels, setHotels] = useState([]);
  const [rateAlerts, setRateAlerts] = useState([]);
  const [accountSnapshot, setAccountSnapshot] = useState({ system_users: [], guest_accounts: [] });
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [activeTab, setActiveTab] = useState(() => (isAdminUser ? 'frontdesk' : 'rates'));

  const [reportSummary, setReportSummary] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [brandRevenueData, setBrandRevenueData] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
    if (!isSystemUser || !isAdminUser) {
=======
>>>>>>> Stashed changes
    if (!availableTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(availableTabs[0]?.key || 'rates');
    }
  }, [activeTab, availableTabs]);

  useEffect(() => {
<<<<<<< Updated upstream
    if (!isSystemUser || (!isAdminUser && !isManagerUser)) {
=======
    if (!isSystemUser) {
>>>>>>> Stashed changes
>>>>>>> Stashed changes
      return;
    }

    async function load() {
      setLoadingHotels(true);
      setLoadingReport(true);
      try {
        const [
          hotelsPayload,
          alertsPayload,
          accountsPayload,
          summaryPayload,
          revenuePayload,
          brandRevenuePayload,
        ] = await Promise.all([
          apiRequest('/hotels'),
          apiRequest('/admin/rates/alerts').catch(() => ({ data: [] })),
          isAdminUser
            ? apiRequest('/admin/accounts').catch(() => ({ data: { system_users: [], guest_accounts: [] } }))
            : Promise.resolve({ data: { system_users: [], guest_accounts: [] } }),
          apiRequest('/admin/reports/summary').catch(() => ({ data: null })),
          apiRequest('/admin/reports/revenue').catch(() => ({ data: [] })),
          apiRequest('/admin/reports/revenue-by-brand').catch(() => ({ data: [] })),
        ]);

        setHotels(hotelsPayload.data || []);
        setRateAlerts(alertsPayload.data || []);
        setAccountSnapshot(accountsPayload.data || { system_users: [], guest_accounts: [] });
        setReportSummary(summaryPayload.data || null);
        setRevenueData(revenuePayload.data || []);
        setBrandRevenueData(brandRevenuePayload.data || []);
      } catch (error) {
        setFlash({ tone: 'error', text: error.message });
      } finally {
        setLoadingHotels(false);
        setLoadingReport(false);
      }
    }

    load();
  }, [isAdminUser, isManagerUser, isSystemUser, setFlash]);

  if (!isSystemUser) {
    return <Navigate to="/login" replace state={{ nextUrl: '/admin' }} />;
  }
<<<<<<< Updated upstream

  if (!isAdminUser && !isManagerUser) {
=======
<<<<<<< Updated upstream
  // Logged in but not ADMIN  cashier portal
  if (!isAdminUser) {
>>>>>>> Stashed changes
    return <Navigate to="/cashier" replace />;
  }
=======
>>>>>>> Stashed changes

  function handleLogout() {
    clearToasts();
    logout();
    navigate('/');
    setTimeout(() => setFlash({ tone: 'success', text: 'Signed out.' }), 80);
  }

  const activeTabMeta = availableTabs.find((tab) => tab.key === activeTab);

  return (
    <div className="app-shell">
      <main className="page-stack">
        <section className="admin-hero">
          <div className="admin-hero-copy">
<<<<<<< Updated upstream
            <p className="page-eyebrow">{isAdminUser ? 'Admin dashboard' : 'Manager dashboard'}</p>
            <h1 className="page-title">
              {isAdminUser ? 'Operations control for LuxeReserve.' : 'Revenue control for LuxeReserve.'}
            </h1>
            <p className="page-text">
              Welcome back, {authSession?.user?.full_name}. Use the module bar below to move directly to
              {isAdminUser ? ' operations, controls, and reporting.' : ' pricing and reporting.'}
=======
<<<<<<< Updated upstream
            <p className="page-eyebrow">Admin dashboard</p>
            <h1 className="page-title">Operations control for LuxeReserve.</h1>
            <p className="page-text">
              Welcome back, {authSession?.user?.full_name}. Use the tab bar below to switch between front desk,
              inventory, account management, and reports without scrolling through the entire admin stack.
=======
            <p className="page-eyebrow">Staff Workspace</p>
            <h1 className="page-title">
              LuxeReserve System Control
            </h1>
            <p className="page-text">
              Welcome back, {authSession?.user?.full_name}. Use the module bar below to navigate your assigned operational areas.
>>>>>>> Stashed changes
>>>>>>> Stashed changes
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
          {isAdminUser ? (
            <article className="admin-metric-card">
              <span>Guest accounts</span>
              <strong>{accountSnapshot.guest_accounts.length}</strong>
            </article>
          ) : null}
          <article className="admin-metric-card">
            <span>Open rate alerts</span>
            <strong>{rateAlerts.length}</strong>
          </article>
        </section>

        <section className="page-card page-card-wide">
          <div className="admin-tabs-head">
            <div>
              <p className="page-eyebrow">Modules</p>
<<<<<<< Updated upstream
              <h2>{isAdminUser ? 'Admin workspace' : 'Manager workspace'}</h2>
=======
<<<<<<< Updated upstream
              <h2>Admin workspace</h2>
=======
              <h2>Workspace Modules</h2>
>>>>>>> Stashed changes
>>>>>>> Stashed changes
            </div>
            <span className="admin-status-pill">{activeTabMeta?.note}</span>
          </div>

          <div className="admin-tabs-bar" role="tablist" aria-label="Admin modules">
            {availableTabs.map((tab) => (
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

<<<<<<< Updated upstream
        {isAdminUser && activeTab === 'frontdesk' ? <AdminFrontDesk hotels={hotels} /> : null}
        {isAdminUser && activeTab === 'inventory' ? <AdminInventory hotels={hotels} loadingHotels={loadingHotels} /> : null}
        {isAdminUser && activeTab === 'housekeeping' ? <AdminHousekeeping hotels={hotels} /> : null}
        {isAdminUser && activeTab === 'maintenance' ? <AdminMaintenance hotels={hotels} /> : null}
        {isAdminUser && activeTab === 'invoice' ? <AdminInvoice hotels={hotels} /> : null}
        {activeTab === 'rates' ? <AdminRates hotels={hotels} /> : null}
        {isAdminUser && activeTab === 'promotions' ? <AdminPromotions hotels={hotels} /> : null}
        {isAdminUser && activeTab === 'channels' ? <AdminLocationChannels /> : null}
        {isAdminUser && activeTab === 'payments' ? <AdminPayments hotels={hotels} /> : null}
        {isAdminUser && activeTab === 'accounts' ? (
<<<<<<< Updated upstream
          <AdminAccounts accountSnapshot={accountSnapshot} setAccountSnapshot={setAccountSnapshot} />
=======
          <AdminAccounts accountSnapshot={accountSnapshot} setAccountSnapshot={setAccountSnapshot} hotels={hotels} />
=======
<<<<<<< Updated upstream
        {activeTab === 'frontdesk'    ? <AdminFrontDesk hotels={hotels} /> : null}
        {activeTab === 'inventory'    ? <AdminInventory hotels={hotels} loadingHotels={loadingHotels} /> : null}
        {activeTab === 'housekeeping' ? <AdminHousekeeping hotels={hotels} /> : null}
        {activeTab === 'maintenance'  ? <AdminMaintenance hotels={hotels} /> : null}
        {activeTab === 'invoice'      ? <AdminInvoice hotels={hotels} /> : null}
        {activeTab === 'rates'        ? <AdminRates hotels={hotels} /> : null}
        {activeTab === 'promotions'   ? <AdminPromotions hotels={hotels} /> : null}
        {activeTab === 'channels'   ? <AdminLocationChannels /> : null}
        {activeTab === 'payments'   ? <AdminPayments hotels={hotels} /> : null}
        {activeTab === 'accounts' ? (
          <AdminAccounts accountSnapshot={accountSnapshot} setAccountSnapshot={setAccountSnapshot} />
=======
        {activeTab === 'frontdesk' ? <AdminFrontDesk hotels={hotels} /> : null}
        {activeTab === 'inventory' ? <AdminInventory hotels={hotels} loadingHotels={loadingHotels} /> : null}
        {activeTab === 'housekeeping' ? <AdminHousekeeping hotels={hotels} /> : null}
        {activeTab === 'maintenance' ? <AdminMaintenance hotels={hotels} /> : null}
        {activeTab === 'invoice' ? <AdminInvoice hotels={hotels} /> : null}
        {activeTab === 'rates' ? <AdminRates hotels={hotels} /> : null}
        {activeTab === 'promotions' ? <AdminPromotions hotels={hotels} /> : null}
        {activeTab === 'channels' ? <AdminLocationChannels /> : null}
        {activeTab === 'payments' ? <AdminPayments hotels={hotels} /> : null}
        {activeTab === 'accounts' ? (
          <AdminAccounts accountSnapshot={accountSnapshot} setAccountSnapshot={setAccountSnapshot} hotels={hotels} />
>>>>>>> Stashed changes
>>>>>>> Stashed changes
>>>>>>> Stashed changes
        ) : null}
        {isAdminUser && activeTab === 'timeline' ? <AdminTimeline hotels={hotels} /> : null}
        {activeTab === 'reports' ? (
          <AdminReports
            reportSummary={reportSummary}
            revenueData={revenueData}
            brandRevenueData={brandRevenueData}
            loading={loadingReport}
          />
        ) : null}

        <ToastContainer />
      </main>
    </div>
  );
}
