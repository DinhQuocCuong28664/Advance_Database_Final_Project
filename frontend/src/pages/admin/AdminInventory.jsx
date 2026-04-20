import { useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/FlashContext';

const INVENTORY_STATUSES = ['OPEN', 'HELD', 'BLOCKED', 'BOOKED'];

function formatDateLabel(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatCurrency(value, currency = 'VND') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export default function AdminInventory({ hotels, loadingHotels }) {
  const { setFlash } = useFlash();
  const [hotelId, setHotelId] = useState(() => (hotels.length ? String(hotels[0].hotel_id) : ''));
  const [checkin, setCheckin] = useState(todayString());
  const [checkout, setCheckout] = useState(addDays(todayString(), 2));
  const [inventoryRooms, setInventoryRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [draftStatuses, setDraftStatuses] = useState({});

  const selectedHotel = useMemo(
    () => hotels.find((h) => String(h.hotel_id) === String(hotelId)) || null,
    [hotels, hotelId],
  );

  const summary = useMemo(() => {
    const recs = inventoryRooms.flatMap((r) => r.availability_records || []);
    const byStatus = recs.reduce((a, r) => {
      a[r.availability_status] = (a[r.availability_status] || 0) + 1;
      return a;
    }, {});
    return {
      roomCount: inventoryRooms.length,
      openCount: byStatus.OPEN || 0,
      heldCount: byStatus.HELD || 0,
      blockedCount: byStatus.BLOCKED || 0,
      bookedCount: byStatus.BOOKED || 0,
    };
  }, [inventoryRooms]);

  async function handleLoad(e) {
    e?.preventDefault?.();
    if (!hotelId) { setFlash({ tone: 'error', text: 'Select a hotel first.' }); return; }
    if (!checkin || !checkout || checkout <= checkin) {
      setFlash({ tone: 'error', text: 'Choose a valid date range for inventory.' }); return;
    }
    setLoading(true);
    try {
      const payload = await apiRequest(`/rooms/availability?hotel_id=${hotelId}&checkin=${checkin}&checkout=${checkout}`);
      const rooms = payload.data || [];
      setInventoryRooms(rooms);
      setDraftStatuses(
        Object.fromEntries(
          rooms.flatMap((r) => (r.availability_records || []).map((rec) => [rec.availability_id, rec.availability_status])),
        ),
      );
      setFlash({
        tone: 'success',
        text: rooms.length
          ? `Loaded inventory for ${selectedHotel?.hotel_name || 'the selected hotel'}.`
          : 'No sellable rooms are currently returned for this date range.',
      });
    } catch (err) {
      setInventoryRooms([]);
      setDraftStatuses({});
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordSave(record) {
    const next = draftStatuses[record.availability_id] || record.availability_status;
    if (next === record.availability_status) return;

    setSavingId(String(record.availability_id));
    try {
      const payload = await apiRequest(`/admin/availability/${record.availability_id}`, {
        method: 'PUT',
        body: JSON.stringify({ availability_status: next, expected_version: record.version_no }),
      });

      setInventoryRooms((cur) =>
        cur.map((room) => ({
          ...room,
          availability_records: (room.availability_records || []).map((e) =>
            e.availability_id === record.availability_id
              ? { ...e, availability_status: payload.data.availability_status, version_no: payload.data.new_version }
              : e,
          ),
        })),
      );
      setDraftStatuses((cur) => ({ ...cur, [record.availability_id]: payload.data.availability_status }));
      setFlash({
        tone: 'success',
        text: `Availability updated for room ${record.room_number || record.room_id} on ${formatDateLabel(record.stay_date)}.`,
      });
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setSavingId('');
    }
  }

  return (
    <section className="page-card page-card-wide">
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Inventory</p>
          <h2>Load hotel inventory by date range</h2>
        </div>
        <span className="admin-status-pill">Active module</span>
      </div>

      <form className="inventory-toolbar" onSubmit={handleLoad}>
        <label>
          Hotel
          <select value={hotelId} onChange={(e) => setHotelId(e.target.value)} disabled={loadingHotels}>
            <option value="">Select hotel</option>
            {hotels.map((h) => (
              <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>
            ))}
          </select>
        </label>
        <label>
          Check-in
          <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
        </label>
        <label>
          Check-out
          <input type="date" value={checkout} min={checkin ? addDays(checkin, 1) : undefined} onChange={(e) => setCheckout(e.target.value)} />
        </label>
        <button className="primary-button" type="submit" disabled={loadingHotels || loading}>
          {loading ? 'Loading inventory...' : 'Load inventory'}
        </button>
      </form>

      <div className="inventory-summary-grid">
        <article className="inventory-summary-card"><span>Open records</span><strong>{summary.openCount}</strong></article>
        <article className="inventory-summary-card"><span>Held records</span><strong>{summary.heldCount}</strong></article>
        <article className="inventory-summary-card"><span>Blocked records</span><strong>{summary.blockedCount}</strong></article>
        <article className="inventory-summary-card"><span>Booked records</span><strong>{summary.bookedCount}</strong></article>
      </div>

      {selectedHotel && (
        <div className="inventory-hotel-note">
          <strong>{selectedHotel.hotel_name}</strong>
          <span>{selectedHotel.brand_name} - {selectedHotel.city_name} - {selectedHotel.currency_code}</span>
        </div>
      )}

      {inventoryRooms.length ? (
        <div className="inventory-room-list">
          {inventoryRooms.map((room) => (
            <article key={room.room_id} className="inventory-room-card">
              <div className="inventory-room-head">
                <div>
                  <h3>Room {room.room_number} - {room.room_type_name}</h3>
                  <p>
                    Floor {room.floor_number} - {room.category} - {room.max_adults} adults -{' '}
                    {formatCurrency(room.min_nightly_rate, selectedHotel?.currency_code || 'VND')} from
                  </p>
                </div>
                <span className="admin-status-pill">{room.availability_records.length} records</span>
              </div>

              <div className="inventory-record-grid">
                {room.availability_records.map((record) => {
                  const draft = draftStatuses[record.availability_id] || record.availability_status;
                  const isSaving = savingId === String(record.availability_id);
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
                          value={draft}
                          onChange={(e) => setDraftStatuses((c) => ({ ...c, [record.availability_id]: e.target.value }))}
                          disabled={isSaving}
                        >
                          {INVENTORY_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <div className="inventory-record-actions">
                        <span>Version {record.version_no}</span>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={isSaving || draft === record.availability_status}
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
  );
}
