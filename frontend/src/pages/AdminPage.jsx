import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';

const INVENTORY_STATUSES = ['OPEN', 'HELD', 'BLOCKED', 'BOOKED'];
const ACCOUNT_STATUSES = ['ACTIVE', 'LOCKED', 'DISABLED'];

const ADMIN_MODULES = [
  {
    title: 'Inventory',
    description: 'Hotel availability review and record-level status control are now wired into this page.',
    status: 'Active module',
  },
  {
    title: 'Front desk',
    description: 'Arrival, check-in, check-out, and walk-in handling will plug in after inventory is stable.',
    status: 'Next phase',
  },
  {
    title: 'Reservations',
    description: 'Reservation lookup and exception handling will follow after the inventory board.',
    status: 'Planned',
  },
  {
    title: 'Operations',
    description: 'Housekeeping and maintenance workspaces will connect after core admin flows are stable.',
    status: 'Planned',
  },
];

function formatDateLabel(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function formatCurrency(value, currency = 'VND') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(isoDate, days) {
  const next = new Date(`${isoDate}T00:00:00`);
  next.setDate(next.getDate() + days);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeHotels(payload) {
  return payload.data || [];
}

function normalizeInventory(payload) {
  return payload.data || [];
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { isSystemUser, authSession, logout } = useAuth();
  const { setFlash } = useFlash();
  const [hotels, setHotels] = useState([]);
  const [inventoryRooms, setInventoryRooms] = useState([]);
  const [rateAlerts, setRateAlerts] = useState([]);
  const [accountSnapshot, setAccountSnapshot] = useState({ system_users: [], guest_accounts: [] });
  const [hotelId, setHotelId] = useState('');
  const [checkin, setCheckin] = useState(todayString());
  const [checkout, setCheckout] = useState(addDays(todayString(), 2));
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [savingRecordId, setSavingRecordId] = useState('');
  const [draftStatuses, setDraftStatuses] = useState({});
  const [accountDrafts, setAccountDrafts] = useState({});
  const [savingAccountKey, setSavingAccountKey] = useState('');

  if (!isSystemUser) {
    return <Navigate to="/login" replace state={{ nextUrl: '/admin' }} />;
  }

  useEffect(() => {
    async function loadAdminFoundations() {
      setLoadingHotels(true);
      try {
        const [hotelsPayload, alertsPayload, accountsPayload] = await Promise.all([
          apiRequest('/hotels'),
          apiRequest('/admin/rates/alerts').catch(() => ({ data: [] })),
          apiRequest('/admin/accounts').catch(() => ({ data: { system_users: [], guest_accounts: [] } })),
        ]);

        const nextHotels = normalizeHotels(hotelsPayload);
        setHotels(nextHotels);
        setRateAlerts(alertsPayload.data || []);
        const nextAccounts = accountsPayload.data || { system_users: [], guest_accounts: [] };
        setAccountSnapshot(nextAccounts);
        setAccountDrafts({
          ...Object.fromEntries(nextAccounts.system_users.map((user) => [`system-${user.user_id}`, user.account_status])),
          ...Object.fromEntries(nextAccounts.guest_accounts.map((guest) => [`guest-${guest.guest_auth_id}`, guest.account_status])),
        });

        if (nextHotels.length) {
          setHotelId(String(nextHotels[0].hotel_id));
        }
      } catch (error) {
        setFlash({ tone: 'error', text: error.message });
      } finally {
        setLoadingHotels(false);
      }
    }

    loadAdminFoundations();
  }, [setFlash]);

  const selectedHotel = useMemo(
    () => hotels.find((hotel) => String(hotel.hotel_id) === String(hotelId)) || null,
    [hotels, hotelId],
  );

  const inventorySummary = useMemo(() => {
    const records = inventoryRooms.flatMap((room) => room.availability_records || []);
    const byStatus = records.reduce((acc, record) => {
      acc[record.availability_status] = (acc[record.availability_status] || 0) + 1;
      return acc;
    }, {});

    return {
      roomCount: inventoryRooms.length,
      openCount: byStatus.OPEN || 0,
      heldCount: byStatus.HELD || 0,
      blockedCount: byStatus.BLOCKED || 0,
      bookedCount: byStatus.BOOKED || 0,
    };
  }, [inventoryRooms]);

  function handleLogout() {
    logout();
    setFlash({ tone: 'success', text: 'Signed out.' });
    navigate('/');
  }

  async function handleInventoryLoad(event) {
    event?.preventDefault?.();

    if (!hotelId) {
      setFlash({ tone: 'error', text: 'Select a hotel first.' });
      return;
    }

    if (!checkin || !checkout || checkout <= checkin) {
      setFlash({ tone: 'error', text: 'Choose a valid date range for inventory.' });
      return;
    }

    setLoadingInventory(true);
    try {
      const payload = await apiRequest(
        `/rooms/availability?hotel_id=${hotelId}&checkin=${checkin}&checkout=${checkout}`,
      );
      const rooms = normalizeInventory(payload);
      setInventoryRooms(rooms);
      setDraftStatuses(
        Object.fromEntries(
          rooms.flatMap((room) =>
            (room.availability_records || []).map((record) => [record.availability_id, record.availability_status]),
          ),
        ),
      );
      setFlash({
        tone: 'success',
        text: rooms.length
          ? `Loaded inventory for ${selectedHotel?.hotel_name || 'the selected hotel'}.`
          : 'No sellable rooms are currently returned for this date range.',
      });
    } catch (error) {
      setInventoryRooms([]);
      setDraftStatuses({});
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setLoadingInventory(false);
    }
  }

  async function handleRecordSave(record) {
    const nextStatus = draftStatuses[record.availability_id] || record.availability_status;
    if (nextStatus === record.availability_status) {
      return;
    }

    setSavingRecordId(String(record.availability_id));
    try {
      const payload = await apiRequest(`/admin/availability/${record.availability_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          availability_status: nextStatus,
          expected_version: record.version_no,
        }),
      });

      setInventoryRooms((current) =>
        current.map((room) => ({
          ...room,
          availability_records: (room.availability_records || []).map((entry) =>
            entry.availability_id === record.availability_id
              ? {
                  ...entry,
                  availability_status: payload.data.availability_status,
                  version_no: payload.data.new_version,
                }
              : entry,
          ),
        })),
      );

      setDraftStatuses((current) => ({
        ...current,
        [record.availability_id]: payload.data.availability_status,
      }));

      setFlash({
        tone: 'success',
        text: `Availability updated for room ${record.room_number || record.room_id} on ${formatDateLabel(record.stay_date)}.`,
      });
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setSavingRecordId('');
    }
  }

  async function handleAccountSave(kind, account) {
    const key = `${kind}-${kind === 'system' ? account.user_id : account.guest_auth_id}`;
    const nextStatus = accountDrafts[key] || account.account_status;

    if (nextStatus === account.account_status) {
      return;
    }

    setSavingAccountKey(key);
    try {
      const path =
        kind === 'system'
          ? `/admin/accounts/system/${account.user_id}`
          : `/admin/accounts/guest/${account.guest_auth_id}`;

      await apiRequest(path, {
        method: 'PUT',
        body: JSON.stringify({ account_status: nextStatus }),
      });

      setAccountSnapshot((current) => ({
        system_users:
          kind === 'system'
            ? current.system_users.map((user) =>
                user.user_id === account.user_id ? { ...user, account_status: nextStatus } : user,
              )
            : current.system_users,
        guest_accounts:
          kind === 'guest'
            ? current.guest_accounts.map((guest) =>
                guest.guest_auth_id === account.guest_auth_id ? { ...guest, account_status: nextStatus } : guest,
              )
            : current.guest_accounts,
      }));

      setAccountDrafts((current) => ({ ...current, [key]: nextStatus }));
      setFlash({
        tone: 'success',
        text: `${kind === 'system' ? account.full_name : account.login_email} updated to ${nextStatus}.`,
      });
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setSavingAccountKey('');
    }
  }

  return (
    <div className="app-shell">
      <main className="page-stack">
        <section className="admin-hero">
          <div className="admin-hero-copy">
            <p className="page-eyebrow">Admin dashboard</p>
            <h1 className="page-title">Inventory control for LuxeReserve.</h1>
            <p className="page-text">
              Welcome back, {authSession?.user?.full_name}. This admin pass starts with room inventory so
              the team can review sellable rooms, inspect day-level availability records, and change statuses
              with optimistic locking.
            </p>
          </div>
          <div className="admin-hero-actions">
            <button className="primary-button" type="button" onClick={() => navigate('/')}>
              Back home
            </button>
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </section>

        <section className="admin-metrics">
          <article className="admin-metric-card">
            <span>Selected hotel</span>
            <strong>{selectedHotel?.hotel_name || (loadingHotels ? 'Loading...' : 'Choose hotel')}</strong>
          </article>
          <article className="admin-metric-card">
            <span>Sellable rooms loaded</span>
            <strong>{inventorySummary.roomCount}</strong>
          </article>
          <article className="admin-metric-card">
            <span>Open rate alerts</span>
            <strong>{rateAlerts.length}</strong>
          </article>
        </section>

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
                {accountSnapshot.system_users.map((user) => (
                  <article key={user.user_id} className="admin-account-row">
                    <div>
                      <strong>{user.full_name}</strong>
                      <span>{user.username} - {user.department || 'N/A'}</span>
                    </div>
                    <div className="admin-account-controls">
                      <select
                        value={accountDrafts[`system-${user.user_id}`] || user.account_status}
                        onChange={(event) =>
                          setAccountDrafts((current) => ({
                            ...current,
                            [`system-${user.user_id}`]: event.target.value,
                          }))
                        }
                        disabled={savingAccountKey === `system-${user.user_id}`}
                      >
                        {ACCOUNT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={
                          savingAccountKey === `system-${user.user_id}` ||
                          (accountDrafts[`system-${user.user_id}`] || user.account_status) === user.account_status
                        }
                        onClick={() => handleAccountSave('system', user)}
                      >
                        {savingAccountKey === `system-${user.user_id}` ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="admin-account-card admin-account-card-wide">
              <div className="admin-card-title">
                <h3>Guest login accounts</h3>
                <span className="admin-status-pill">{accountSnapshot.guest_accounts.length} accounts</span>
              </div>
              <div className="admin-account-list">
                {accountSnapshot.guest_accounts.map((guest) => (
                  <article key={guest.guest_auth_id} className="admin-account-row">
                    <div>
                      <strong>{guest.full_name}</strong>
                      <span>
                        {guest.login_email} - {guest.guest_code}
                        {guest.tier_code ? ` - ${guest.tier_code}` : ' - No loyalty tier'}
                      </span>
                    </div>
                    <div className="admin-account-controls">
                      <select
                        value={accountDrafts[`guest-${guest.guest_auth_id}`] || guest.account_status}
                        onChange={(event) =>
                          setAccountDrafts((current) => ({
                            ...current,
                            [`guest-${guest.guest_auth_id}`]: event.target.value,
                          }))
                        }
                        disabled={savingAccountKey === `guest-${guest.guest_auth_id}`}
                      >
                        {ACCOUNT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={
                          savingAccountKey === `guest-${guest.guest_auth_id}` ||
                          (accountDrafts[`guest-${guest.guest_auth_id}`] || guest.account_status) === guest.account_status
                        }
                        onClick={() => handleAccountSave('guest', guest)}
                      >
                        {savingAccountKey === `guest-${guest.guest_auth_id}` ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="page-card page-card-wide">
          <div className="admin-section-head">
            <div>
              <p className="page-eyebrow">Inventory</p>
              <h2>Load hotel inventory by date range</h2>
            </div>
            <span className="admin-status-pill">Active module</span>
          </div>

          <form className="inventory-toolbar" onSubmit={handleInventoryLoad}>
            <label>
              Hotel
              <select value={hotelId} onChange={(event) => setHotelId(event.target.value)} disabled={loadingHotels}>
                <option value="">Select hotel</option>
                {hotels.map((hotel) => (
                  <option key={hotel.hotel_id} value={hotel.hotel_id}>
                    {hotel.hotel_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Check-in
              <input type="date" value={checkin} onChange={(event) => setCheckin(event.target.value)} />
            </label>
            <label>
              Check-out
              <input
                type="date"
                value={checkout}
                min={checkin ? addDays(checkin, 1) : undefined}
                onChange={(event) => setCheckout(event.target.value)}
              />
            </label>
            <button className="primary-button" type="submit" disabled={loadingHotels || loadingInventory}>
              {loadingInventory ? 'Loading inventory...' : 'Load inventory'}
            </button>
          </form>

          <div className="inventory-summary-grid">
            <article className="inventory-summary-card">
              <span>Open records</span>
              <strong>{inventorySummary.openCount}</strong>
            </article>
            <article className="inventory-summary-card">
              <span>Held records</span>
              <strong>{inventorySummary.heldCount}</strong>
            </article>
            <article className="inventory-summary-card">
              <span>Blocked records</span>
              <strong>{inventorySummary.blockedCount}</strong>
            </article>
            <article className="inventory-summary-card">
              <span>Booked records</span>
              <strong>{inventorySummary.bookedCount}</strong>
            </article>
          </div>

          {selectedHotel ? (
            <div className="inventory-hotel-note">
              <strong>{selectedHotel.hotel_name}</strong>
              <span>
                {selectedHotel.brand_name} - {selectedHotel.city_name} - {selectedHotel.currency_code}
              </span>
            </div>
          ) : null}

          {inventoryRooms.length ? (
            <div className="inventory-room-list">
              {inventoryRooms.map((room) => (
                <article key={room.room_id} className="inventory-room-card">
                  <div className="inventory-room-head">
                    <div>
                      <h3>
                        Room {room.room_number} - {room.room_type_name}
                      </h3>
                      <p>
                        Floor {room.floor_number} - {room.category} - {room.max_adults} adults -{' '}
                        {formatCurrency(room.min_nightly_rate, selectedHotel?.currency_code || 'VND')} from
                      </p>
                    </div>
                    <span className="admin-status-pill">{room.availability_records.length} records</span>
                  </div>

                  <div className="inventory-record-grid">
                    {room.availability_records.map((record) => {
                      const currentDraft = draftStatuses[record.availability_id] || record.availability_status;
                      const isSaving = savingRecordId === String(record.availability_id);
                      return (
                        <article key={record.availability_id} className="inventory-record-card">
                          <div className="inventory-record-top">
                            <strong>{formatDateLabel(record.stay_date)}</strong>
                            <span className={`inventory-status-pill ${record.availability_status.toLowerCase()}`}>
                              {record.availability_status}
                            </span>
                          </div>
                          <label className="inventory-record-field">
                            Status
                            <select
                              value={currentDraft}
                              onChange={(event) =>
                                setDraftStatuses((current) => ({
                                  ...current,
                                  [record.availability_id]: event.target.value,
                                }))
                              }
                              disabled={isSaving}
                            >
                              {INVENTORY_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="inventory-record-actions">
                            <span>Version {record.version_no}</span>
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={isSaving || currentDraft === record.availability_status}
                              onClick={() => handleRecordSave({ ...record, room_number: room.room_number })}
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="inventory-empty-state">
              <strong>No inventory loaded yet.</strong>
              <span>
                Choose a hotel and date range to load sellable rooms. Current backend behavior only returns rooms
                with valid rate data and no blocking records in the selected range.
              </span>
            </div>
          )}
        </section>

        <section className="page-card page-card-wide">
          <div className="admin-section-head">
            <div>
              <p className="page-eyebrow">Modules</p>
              <h2>Admin workspace map</h2>
            </div>
          </div>
          <div className="admin-module-grid">
            {ADMIN_MODULES.map((module) => (
              <article key={module.title} className="admin-module-card">
                <div className="admin-module-top">
                  <h3>{module.title}</h3>
                  <span className="admin-status-pill">{module.status}</span>
                </div>
                <p>{module.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
