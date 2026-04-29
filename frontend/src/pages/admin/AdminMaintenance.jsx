import { useEffect, useState, useRef, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

//  Constants 
const ISSUE_CATEGORIES = [
  'PLUMBING', 'ELECTRICAL', 'HVAC', 'STRUCTURAL',
  'FURNITURE', 'APPLIANCE', 'PEST_CONTROL', 'CLEANING', 'OTHER',
];
const SEVERITY_LEVELS  = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TICKET_STATUSES  = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const SEVERITY_STYLE = {
  CRITICAL: { bg: 'var(--priority-critical-bg)', color: 'var(--priority-critical-color)', border: 'var(--priority-critical-border)' },
  HIGH:     { bg: 'var(--priority-high-bg)', color: 'var(--priority-high-color)', border: 'var(--priority-high-border)' },
  MEDIUM:   { bg: 'var(--priority-medium-bg)', color: 'var(--priority-medium-color)', border: 'var(--priority-medium-border)' },
  LOW:      { bg: 'var(--priority-low-bg)', color: 'var(--priority-low-color)', border: 'var(--priority-low-border)' },
};
const STATUS_STYLE = {
  OPEN:        { bg: 'var(--maint-open-bg)', color: 'var(--maint-open-color)' },
  ASSIGNED:    { bg: 'var(--maint-assigned-bg)', color: 'var(--maint-assigned-color)' },
  IN_PROGRESS: { bg: 'var(--maint-inprogress-bg)', color: 'var(--maint-inprogress-color)' },
  RESOLVED:    { bg: 'var(--maint-resolved-bg)', color: 'var(--maint-resolved-color)' },
  CLOSED:      { bg: 'var(--maint-closed-bg)', color: 'var(--maint-closed-color)' },
};

const CATEGORY_ICON = {
  PLUMBING:     '',
  ELECTRICAL:   '',
  HVAC:         '',
  STRUCTURAL:   '',
  FURNITURE:    '',
  APPLIANCE:    '',
  PEST_CONTROL: '',
  CLEANING:     '',
  OTHER:        '',
};

function fmt(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

const EMPTY_FORM = {
  room_id: '',
  issue_category: 'PLUMBING',
  issue_description: '',
  severity_level: 'MEDIUM',
};

//  Main Component 
export default function AdminMaintenance({ hotels }) {
  const { setFlash } = useFlash();

  const [hotelId,     setHotelId]     = useState(hotels[0]?.hotel_id || '');
  const [tickets,     setTickets]     = useState([]);
  const [rooms,       setRooms]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSev,   setFilterSev]   = useState('');

  // New ticket form
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Update modal
  const [updateTarget, setUpdateTarget] = useState(null); // ticket being updated
  const [updateFields, setUpdateFields] = useState({ status: '', resolution_note: '' });
  const [updateBusy,   setUpdateBusy]   = useState(false);
  const filterRef = useRef({ status: '', severity: '' });

  // Load tickets
  useEffect(() => {
    filterRef.current = { status: filterStatus, severity: filterSev };
  }, [filterStatus, filterSev]);

  const loadTickets = useCallback(async (hid, st = filterRef.current.status, sv = filterRef.current.severity) => {
    const h = hid || hotelId;
    if (!h) return;
    setLoading(true);
    try {
      let qs = `?hotel_id=${h}`;
      if (st) qs += `&status=${st}`;
      if (sv) qs += `&severity=${sv}`;
      const payload = await apiRequest(`/maintenance${qs}`);
      setTickets(payload.data || []);
    } catch (e) {
      setFlash({ tone: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  }, [hotelId, setFlash]);

  // Load rooms for the selected hotel
  const loadRooms = useCallback(async (hid) => {
    if (!hid) return;
    try {
      const payload = await apiRequest(`/rooms?hotel_id=${hid}&limit=200`);
      setRooms(payload.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (hotelId) {
      loadTickets(hotelId);
      loadRooms(hotelId);
    }
  }, [hotelId, loadTickets, loadRooms]);

  // Create ticket
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.issue_description.trim()) {
      setFlash({ tone: 'error', text: 'Issue description is required.' }); return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          hotel_id: Number(hotelId),
          room_id: form.room_id ? Number(form.room_id) : null,
          issue_category: form.issue_category,
          issue_description: form.issue_description,
          severity_level: form.severity_level,
        }),
      });
      setFlash({ tone: 'success', text: 'Maintenance ticket created.' });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadTickets(hotelId, filterStatus, filterSev);
    } catch (e) {
      setFlash({ tone: 'error', text: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Update ticket
  async function handleUpdate(e) {
    e.preventDefault();
    if (!updateFields.status) return;
    setUpdateBusy(true);
    try {
      await apiRequest(`/maintenance/${updateTarget.maintenance_ticket_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: updateFields.status,
          resolution_note: updateFields.resolution_note || null,
        }),
      });
      setFlash({ tone: 'success', text: `Ticket #${updateTarget.maintenance_ticket_id} updated.` });
      setUpdateTarget(null);
      await loadTickets(hotelId, filterStatus, filterSev);
    } catch (e) {
      setFlash({ tone: 'error', text: e.message });
    } finally {
      setUpdateBusy(false);
    }
  }

  // Derived stats
  const openCount     = tickets.filter(t => t.status === 'OPEN').length;
  const criticalCount = tickets.filter(t => t.severity_level === 'CRITICAL' && !['RESOLVED','CLOSED'].includes(t.status)).length;
  const inProgCount   = tickets.filter(t => t.status === 'IN_PROGRESS').length;

  return (
    <section className="page-card page-card-wide" id="admin-maintenance">

      {/*  Update Modal  */}
      {updateTarget && (
        <div className="pm-overlay" onClick={e => { if (e.target === e.currentTarget) setUpdateTarget(null); }}>
          <div className="pm-dialog" style={{ maxWidth: 480 }}>
            <div className="pm-header">
              <div>
                <p className="pm-eyebrow">Update ticket #{updateTarget.maintenance_ticket_id}</p>
                <h2 className="pm-title">{updateTarget.issue_category.replace(/_/g,' ')}</h2>
                <p className="pm-guest">{updateTarget.issue_description?.slice(0, 80)}</p>
              </div>
              <button type="button" className="pm-close" onClick={() => setUpdateTarget(null)}></button>
            </div>
            <form onSubmit={handleUpdate} style={{ padding: '0 24px 24px' }}>
              <div className="maint-form-grid">
                <label>
                  New status *
                  <select
                    value={updateFields.status}
                    onChange={e => setUpdateFields(f => ({ ...f, status: e.target.value }))}
                    required
                  >
                    <option value="">Select status</option>
                    {TICKET_STATUSES.map(s => (
                      <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                    ))}
                  </select>
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  Resolution note
                  <textarea
                    rows="3"
                    value={updateFields.resolution_note}
                    onChange={e => setUpdateFields(f => ({ ...f, resolution_note: e.target.value }))}
                    placeholder="Describe what was done to resolve the issue..."
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="ghost-button" onClick={() => setUpdateTarget(null)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={updateBusy}>
                  {updateBusy ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*  Header  */}
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Maintenance</p>
          <h2>Issue tracking &amp; repair management</h2>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Report issue'}
        </button>
      </div>

      {/*  Hotel selector  */}
      <div className="inventory-toolbar" style={{ marginBottom: 16 }}>
        <label>
          Hotel
          <select value={hotelId} onChange={e => { setHotelId(e.target.value); setTickets([]); }}>
            <option value="">Select hotel</option>
            {hotels.map(h => <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); loadTickets(hotelId, e.target.value, filterSev); }}>
            <option value="">All statuses</option>
            {TICKET_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
        </label>
        <label>
          Severity
          <select value={filterSev}
            onChange={e => { setFilterSev(e.target.value); loadTickets(hotelId, filterStatus, e.target.value); }}>
            <option value="">All severities</option>
            {SEVERITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button type="button" className="primary-button"
          onClick={() => loadTickets(hotelId, filterStatus, filterSev)}
          disabled={!hotelId || loading}>
          {loading ? 'Loading...' : ' Refresh'}
        </button>
      </div>

      {/*  Stats pills  */}
      {tickets.length > 0 && (
        <div className="maint-stats-row">
          <span className="maint-stat"><strong>{tickets.length}</strong> total</span>
          {openCount > 0     && <span className="maint-stat maint-stat--warn"><strong>{openCount}</strong> open</span>}
          {criticalCount > 0 && <span className="maint-stat maint-stat--danger"><strong>{criticalCount}</strong> critical</span>}
          {inProgCount > 0   && <span className="maint-stat maint-stat--info"><strong>{inProgCount}</strong> in progress</span>}
        </div>
      )}

      {/*  New ticket form  */}
      {showForm && (
        <form className="maint-new-form page-card" onSubmit={handleSubmit}>
          <p className="page-eyebrow" style={{ marginBottom: 12 }}>New maintenance ticket</p>
          <div className="maint-form-grid">
            <label>
              Category *
              <select value={form.issue_category}
                onChange={e => setForm(f => ({ ...f, issue_category: e.target.value }))}>
                {ISSUE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_ICON[c]} {c.replace(/_/g,' ')}</option>
                ))}
              </select>
            </label>
            <label>
              Severity *
              <select value={form.severity_level}
                onChange={e => setForm(f => ({ ...f, severity_level: e.target.value }))}>
                {SEVERITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Room (optional)
              <select value={form.room_id}
                onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}>
                <option value=""> Common area / no specific room </option>
                {rooms.map(r => (
                  <option key={r.room_id} value={r.room_id}>
                    Room {r.room_number}  {r.room_type_name || 'Room'}  Floor {r.floor_number}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Issue description *
              <textarea rows="3"
                value={form.issue_description}
                onChange={e => setForm(f => ({ ...f, issue_description: e.target.value }))}
                placeholder="Describe the problem clearly. e.g. 'Pipe leaking under sink in bathroom, water stain on floor.'"
                required
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="ghost-button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
              Discard
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit ticket'}
            </button>
          </div>
        </form>
      )}

      {/*  Ticket list  */}
      {loading && <p className="fd-loading">Loading maintenance tickets...</p>}

      {!loading && !hotelId && (
        <div className="svc-orders-empty">
          <span>🏨</span>
          <p>Select a hotel to view tickets.</p>
        </div>
      )}

      {!loading && hotelId && tickets.length === 0 && (
        <div className="svc-orders-empty">
          <span>🔧</span>
          <p>No maintenance tickets found.</p>
          <small>All clear  or adjust filters to see closed tickets.</small>
        </div>
      )}

      {tickets.length > 0 && (
        <div className="maint-list">
          {tickets.map(ticket => {
            const sevStyle  = SEVERITY_STYLE[ticket.severity_level] || {};
            const statStyle = STATUS_STYLE[ticket.status] || {};
            const done      = ['RESOLVED','CLOSED'].includes(ticket.status);
            return (
              <article key={ticket.maintenance_ticket_id}
                className={`maint-card${done ? ' maint-card--done' : ''}`}
                style={{ borderLeftColor: sevStyle.border || 'var(--admin-table-border)' }}>

                <div className="maint-card-top">
                  <div className="maint-card-badges">
                    <span className="maint-sev-pill" style={{ background: sevStyle.bg, color: sevStyle.color }}>
                      {ticket.severity_level}
                    </span>
                    <span className="maint-status-pill" style={{ background: statStyle.bg, color: statStyle.color }}>
                      {ticket.status.replace(/_/g,' ')}
                    </span>
                    <span className="maint-category-pill">
                      {CATEGORY_ICON[ticket.issue_category] || ''} {ticket.issue_category.replace(/_/g,' ')}
                    </span>
                  </div>
                  <span className="maint-ticket-id">#{ticket.maintenance_ticket_id}</span>
                </div>

                <p className="maint-desc">{ticket.issue_description}</p>

                <div className="maint-card-meta">
                  {ticket.room_number
                    ? <span> Room {ticket.room_number}  Floor {ticket.floor_number}</span>
                    : <span> Common area</span>}
                  <span> Reported {fmt(ticket.reported_at)}</span>
                  {ticket.reporter_name  && <span> By {ticket.reporter_name}</span>}
                  {ticket.assignee_name  && <span> Assigned to {ticket.assignee_name}</span>}
                  {ticket.resolved_at    && <span> Resolved {fmt(ticket.resolved_at)}</span>}
                  {ticket.resolution_hours != null && (
                    <span> {ticket.resolution_hours}h to resolve</span>
                  )}
                </div>

                {ticket.resolution_note && (
                  <p className="maint-resolution-note"> {ticket.resolution_note}</p>
                )}

                {!done && (
                  <div className="maint-card-actions">
                    {ticket.status === 'OPEN' && (
                      <button type="button" className="primary-button"
                        onClick={() => { setUpdateTarget(ticket); setUpdateFields({ status: 'IN_PROGRESS', resolution_note: '' }); }}>
                        Start working
                      </button>
                    )}
                    {ticket.status === 'IN_PROGRESS' && (
                      <button type="button" className="primary-button"
                        onClick={() => { setUpdateTarget(ticket); setUpdateFields({ status: 'RESOLVED', resolution_note: '' }); }}>
                        Mark resolved
                      </button>
                    )}
                    <button type="button" className="ghost-button"
                      onClick={() => { setUpdateTarget(ticket); setUpdateFields({ status: ticket.status, resolution_note: ticket.resolution_note || '' }); }}>
                      Update
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
