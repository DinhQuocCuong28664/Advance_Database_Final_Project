import { useEffect, useState, useRef, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

const TASK_TYPES = ['CLEANING', 'DEEP_CLEAN', 'TURNDOWN', 'INSPECTION', 'LINEN_CHANGE', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES   = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'VERIFIED'];

const PRIORITY_STYLE = {
  CRITICAL: { bg: '#fee2e2', color: '#7f1d1d', border: '#dc2626' },
  HIGH:     { bg: '#fef3c7', color: '#78350f', border: '#d97706' },
  MEDIUM:   { bg: '#dbeafe', color: '#1e3a8a', border: '#3b82f6' },
  LOW:      { bg: '#dcfce7', color: '#14532d', border: '#22c55e' },
};
const STATUS_STYLE = {
  OPEN:        { bg: '#f3f4f6', color: '#374151' },
  ASSIGNED:    { bg: '#ede9fe', color: '#4c1d95' },
  IN_PROGRESS: { bg: '#dbeafe', color: '#1e40af' },
  DONE:        { bg: '#dcfce7', color: '#14532d' },
  VERIFIED:    { bg: '#d1fae5', color: '#065f46' },
};
const TASK_ICON = {
  CLEANING:     '', DEEP_CLEAN: '', TURNDOWN: '',
  INSPECTION:   '', LINEN_CHANGE: '', OTHER: '',
};

// Valid next steps for each status
const NEXT_STATUS = {
  ASSIGNED:    ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE'],
  DONE:        ['VERIFIED'],
};

function fmt(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

const EMPTY_FORM = { room_id: '', task_type: 'CLEANING', priority_level: 'MEDIUM', note: '', scheduled_for: '' };

export default function AdminHousekeeping({ hotels }) {
  const { setFlash } = useFlash();

  const [hotelId,   setHotelId]   = useState(hotels[0]?.hotel_id || '');
  const [tasks,     setTasks]     = useState([]);
  const [summary,   setSummary]   = useState({});
  const [rooms,     setRooms]     = useState([]);
  const [staff,     setStaff]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [assignTarget, setAssignTarget] = useState(null);
  const [assignStaff,  setAssignStaff]  = useState('');
  const [assignBusy,   setAssignBusy]   = useState(false);

  const [statusBusy, setStatusBusy] = useState(null); // task id being updated
  const filterRef = useRef({ status: '', priority: '' });

  useEffect(() => {
    filterRef.current = { status: filterStatus, priority: filterPriority };
  }, [filterStatus, filterPriority]);

  const loadTasks = useCallback(async (hid, st = filterRef.current.status, pr = filterRef.current.priority) => {
    const h = hid || hotelId;
    if (!h) return;
    setLoading(true);
    try {
      let qs = `?hotel_id=${h}`;
      if (st) qs += `&status=${st}`;
      if (pr) qs += `&priority=${pr}`;
      const payload = await apiRequest(`/housekeeping${qs}`);
      setTasks(payload.data || []);
      setSummary(payload.summary || {});
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setLoading(false); }
  }, [hotelId, setFlash]);

  const loadRooms = useCallback(async (hid) => {
    if (!hid) return;
    try {
      const p = await apiRequest(`/rooms?hotel_id=${hid}&limit=300`);
      setRooms(p.data || []);
    } catch { /* ignore */ }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const p = await apiRequest('/admin/accounts');
      setStaff((p.data?.system_users || []).filter(u => !['ADMIN'].includes(u.role)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (hotelId) {
      loadTasks(hotelId);
      loadRooms(hotelId);
    }
  }, [hotelId, loadTasks, loadRooms]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.room_id) { setFlash({ tone: 'error', text: 'Select a room.' }); return; }
    setSubmitting(true);
    try {
      await apiRequest('/housekeeping', {
        method: 'POST',
        body: JSON.stringify({
          hotel_id:       Number(hotelId),
          room_id:        Number(form.room_id),
          task_type:      form.task_type,
          priority_level: form.priority_level,
          note:           form.note || null,
          scheduled_for:  form.scheduled_for || null,
        }),
      });
      setFlash({ tone: 'success', text: 'Housekeeping task created.' });
      setForm(EMPTY_FORM); setShowForm(false);
      await loadTasks(hotelId, filterStatus, filterPriority);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setSubmitting(false); }
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!assignStaff) { setFlash({ tone: 'error', text: 'Select a staff member.' }); return; }
    setAssignBusy(true);
    try {
      await apiRequest(`/housekeeping/${assignTarget.hk_task_id}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ staff_id: Number(assignStaff) }),
      });
      setFlash({ tone: 'success', text: `Task #${assignTarget.hk_task_id} assigned.` });
      setAssignTarget(null); setAssignStaff('');
      await loadTasks(hotelId, filterStatus, filterPriority);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setAssignBusy(false); }
  }

  async function advanceStatus(task, newStatus) {
    setStatusBusy(task.hk_task_id);
    try {
      await apiRequest(`/housekeeping/${task.hk_task_id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setFlash({ tone: 'success', text: `Task #${task.hk_task_id}  ${newStatus}.` });
      await loadTasks(hotelId, filterStatus, filterPriority);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setStatusBusy(null); }
  }

  const openCount    = summary.OPEN    || 0;
  const assignedCount= summary.ASSIGNED|| 0;
  const doneCount    = summary.DONE    || 0;

  return (
    <section className="page-card page-card-wide" id="admin-housekeeping">

      {/*  Assign Modal  */}
      {assignTarget && (
        <div className="pm-overlay" onClick={e => { if (e.target === e.currentTarget) setAssignTarget(null); }}>
          <div className="pm-dialog" style={{ maxWidth: 420 }}>
            <div className="pm-header">
              <div>
                <p className="pm-eyebrow">Assign staff  Task #{assignTarget.hk_task_id}</p>
                <h2 className="pm-title">{TASK_ICON[assignTarget.task_type]} {assignTarget.task_type.replace(/_/g,' ')}</h2>
                <p className="pm-guest">Room {assignTarget.room_number}  {assignTarget.room_type_name}</p>
              </div>
              <button type="button" className="pm-close" onClick={() => setAssignTarget(null)}></button>
            </div>
            <form onSubmit={handleAssign} style={{ padding: '0 24px 24px' }}>
              <label style={{ display:'flex', flexDirection:'column', gap:6, fontSize:'0.86rem', fontWeight:600, color:'var(--text-soft)', marginBottom:16 }}>
                Staff member
                <select value={assignStaff} onChange={e => setAssignStaff(e.target.value)} required>
                  <option value="">Select staff</option>
                  {staff.map(s => <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.role})</option>)}
                </select>
              </label>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="ghost-button" onClick={() => setAssignTarget(null)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={assignBusy}>
                  {assignBusy ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*  Header  */}
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Housekeeping</p>
          <h2>Room cleaning &amp; inspection tasks</h2>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New task'}
        </button>
      </div>

      {/*  Toolbar  */}
      <div className="inventory-toolbar" style={{ marginBottom: 16 }}>
        <label>
          Hotel
          <select value={hotelId} onChange={e => { setHotelId(e.target.value); setTasks([]); }}>
            <option value="">Select hotel</option>
            {hotels.map(h => <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); loadTasks(hotelId, e.target.value, filterPriority); }}>
            <option value="">All</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select value={filterPriority}
            onChange={e => { setFilterPriority(e.target.value); loadTasks(hotelId, filterStatus, e.target.value); }}>
            <option value="">All</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button type="button" className="primary-button"
          onClick={() => loadTasks(hotelId, filterStatus, filterPriority)}
          disabled={!hotelId || loading}>
          {loading ? 'Loading...' : ' Refresh'}
        </button>
      </div>

      {/*  Stats  */}
      {Object.keys(summary).length > 0 && (
        <div className="maint-stats-row">
          {openCount > 0     && <span className="maint-stat maint-stat--warn"><strong>{openCount}</strong> open</span>}
          {assignedCount > 0 && <span className="maint-stat maint-stat--info"><strong>{assignedCount}</strong> assigned</span>}
          {(summary.IN_PROGRESS||0) > 0 && <span className="maint-stat maint-stat--info"><strong>{summary.IN_PROGRESS}</strong> in progress</span>}
          {doneCount > 0     && <span className="maint-stat"><strong>{doneCount}</strong> done</span>}
          {(summary.VERIFIED||0) > 0 && <span className="maint-stat"><strong>{summary.VERIFIED}</strong> verified</span>}
        </div>
      )}

      {/*  Create Form  */}
      {showForm && (
        <form className="maint-new-form page-card" onSubmit={handleCreate}>
          <p className="page-eyebrow" style={{ marginBottom: 12 }}>New housekeeping task</p>
          <div className="maint-form-grid">
            <label>
              Room *
              <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} required>
                <option value="">Select room</option>
                {rooms.map(r => (
                  <option key={r.room_id} value={r.room_id}>
                    Room {r.room_number}  Floor {r.floor_number}  {r.room_type_name || 'Room'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Task type *
              <select value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}>
                {TASK_TYPES.map(t => <option key={t} value={t}>{TASK_ICON[t]} {t.replace(/_/g,' ')}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={form.priority_level} onChange={e => setForm(f => ({ ...f, priority_level: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>
              Scheduled for
              <input type="datetime-local" value={form.scheduled_for}
                onChange={e => setForm(f => ({ ...f, scheduled_for: e.target.value }))} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Note
              <input type="text" value={form.note} placeholder="Optional note for the staff"
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </label>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:12 }}>
            <button type="button" className="ghost-button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Discard</button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create task'}
            </button>
          </div>
        </form>
      )}

      {/*  Task List  */}
      {loading && <p className="fd-loading">Loading tasks...</p>}

      {!loading && hotelId && tasks.length === 0 && (
        <div className="svc-orders-empty">
          <span></span><p>No housekeeping tasks found.</p>
          <small>Adjust filters or create a new task.</small>
        </div>
      )}
      {!loading && !hotelId && (
        <div className="svc-orders-empty"><span></span><p>Select a hotel to view tasks.</p></div>
      )}

      {tasks.length > 0 && (
        <div className="maint-list">
          {tasks.map(task => {
            const pri  = PRIORITY_STYLE[task.priority_level] || {};
            const stat = STATUS_STYLE[task.task_status]      || {};
            const isBusy = statusBusy === task.hk_task_id;
            const done = ['DONE','VERIFIED'].includes(task.task_status);
            const nextSteps = NEXT_STATUS[task.task_status] || [];
            return (
              <article key={task.hk_task_id}
                className={`maint-card${done ? ' maint-card--done' : ''}`}
                style={{ borderLeftColor: pri.border || '#ccc' }}>

                <div className="maint-card-top">
                  <div className="maint-card-badges">
                    <span className="maint-sev-pill" style={{ background: pri.bg, color: pri.color }}>
                      {task.priority_level}
                    </span>
                    <span className="maint-status-pill" style={{ background: stat.bg, color: stat.color }}>
                      {task.task_status.replace(/_/g,' ')}
                    </span>
                    <span className="maint-category-pill">
                      {TASK_ICON[task.task_type] || ''} {task.task_type.replace(/_/g,' ')}
                    </span>
                  </div>
                  <span className="maint-ticket-id">#{task.hk_task_id}</span>
                </div>

                {task.note && <p className="maint-desc">{task.note}</p>}

                <div className="maint-card-meta">
                  <span> Room {task.room_number}  Floor {task.floor_number}  {task.room_type_name}</span>
                  {task.assigned_staff_name
                    ? <span> Assigned: {task.assigned_staff_name}</span>
                    : <span style={{ color:'#d97706' }}> Unassigned</span>}
                  {task.scheduled_for && <span> Scheduled: {fmt(task.scheduled_for)}</span>}
                  {task.started_at    && <span> Started: {fmt(task.started_at)}</span>}
                  {task.completed_at  && <span> Done: {fmt(task.completed_at)}</span>}
                  {task.duration_minutes != null && <span> {task.duration_minutes} min</span>}
                </div>

                <div className="maint-card-actions">
                  {task.task_status === 'OPEN' && (
                    <button type="button" className="primary-button"
                      onClick={() => { setAssignTarget(task); setAssignStaff(''); }}>
                      Assign staff
                    </button>
                  )}
                  {nextSteps.map(ns => (
                    <button key={ns} type="button" className="primary-button"
                      disabled={isBusy} onClick={() => advanceStatus(task, ns)}>
                      {isBusy ? '...' : ns === 'IN_PROGRESS' ? ' Start' : ns === 'DONE' ? ' Mark done' : ' Verify'}
                    </button>
                  ))}
                  {task.task_status === 'OPEN' || task.task_status === 'ASSIGNED' ? (
                    <button type="button" className="ghost-button"
                      onClick={() => { setAssignTarget(task); setAssignStaff(task.assigned_staff_id || ''); }}>
                      {task.assigned_staff_name ? 'Reassign' : 'Assign'}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
