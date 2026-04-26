import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

const AGE_OPTS = ['ADULT', 'CHILD', 'INFANT'];
const AGE_ICONS = { ADULT: '', CHILD: '', INFANT: '' };

//  Add Guest Form 
function AddGuestForm({ reservationId, onAdded, onCancel }) {
  const { setFlash } = useFlash();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    age_category: 'ADULT',
    nationality_country_code: '',
    document_type: '',
    document_no: '',
    special_note: '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) { setFlash({ tone: 'error', text: 'Full name is required' }); return; }
    setSaving(true);
    try {
      const res = await apiRequest(`/reservations/${reservationId}/guests`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          nationality_country_code: form.nationality_country_code || null,
          document_type: form.document_type || null,
          document_no: form.document_no || null,
          special_note: form.special_note || null,
        }),
      });
      setFlash({ tone: 'success', text: `${form.full_name} added as ${form.age_category.toLowerCase()}` });
      onAdded(res.data);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="ag-add-form" onSubmit={submit}>
      <div className="ag-form-row">
        <div className="ag-form-field ag-form-field--wide">
          <label>Full Name *</label>
          <input
            className="fd-input" type="text" required
            value={form.full_name} onChange={e => set('full_name', e.target.value)}
            placeholder="e.g. Jane Smith"
          />
        </div>
        <div className="ag-form-field">
          <label>Age Category</label>
          <select className="fd-select" value={form.age_category} onChange={e => set('age_category', e.target.value)}>
            {AGE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="ag-form-field">
          <label>Nationality (2-letter)</label>
          <input
            className="fd-input" type="text" maxLength={2}
            value={form.nationality_country_code} onChange={e => set('nationality_country_code', e.target.value.toUpperCase())}
            placeholder="US / VN / SG"
          />
        </div>
      </div>
      <div className="ag-form-row">
        <div className="ag-form-field">
          <label>Document Type</label>
          <select className="fd-select" value={form.document_type} onChange={e => set('document_type', e.target.value)}>
            <option value=""> None </option>
            <option value="PASSPORT">Passport</option>
            <option value="NATIONAL_ID">National ID</option>
            <option value="DRIVERS_LICENSE">Driver's License</option>
          </select>
        </div>
        <div className="ag-form-field ag-form-field--wide">
          <label>Document No.</label>
          <input className="fd-input" type="text" value={form.document_no}
            onChange={e => set('document_no', e.target.value)} placeholder="A12345678" />
        </div>
        <div className="ag-form-field ag-form-field--wide">
          <label>Special Note</label>
          <input className="fd-input" type="text" value={form.special_note}
            onChange={e => set('special_note', e.target.value)} placeholder="Dietary restrictions, etc." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Adding...' : '+ Add Guest'}
        </button>
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

//  Guest Row 
function GuestRow({ guest, onRemove }) {
  const [removing, setRemoving] = useState(false);
  const { setFlash } = useFlash();
  const icon = AGE_ICONS[guest.age_category] || '';

  async function remove() {
    if (!confirm(`Remove ${guest.full_name}?`)) return;
    setRemoving(true);
    try {
      await apiRequest(`/reservations/${guest.reservation_id}/guests/${guest.reservation_guest_id}`, { method: 'DELETE' });
      setFlash({ tone: 'success', text: `${guest.full_name} removed` });
      onRemove(guest.reservation_guest_id);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className={`ag-row ${guest.is_primary_guest ? 'ag-row--primary' : ''}`}>
      <span className="ag-icon">{icon}</span>
      <div className="ag-info">
        <span className="ag-name">
          {guest.full_name}
          {guest.is_primary_guest && <span className="ag-primary-badge">Primary</span>}
        </span>
        <span className="ag-meta">
          {guest.age_category}
          {guest.nationality_country_code && `  ${guest.nationality_country_code}`}
          {guest.document_type && `  ${guest.document_type}`}
          {guest.document_no && ` #${guest.document_no}`}
        </span>
        {guest.special_note && <span className="ag-note">"{guest.special_note}"</span>}
      </div>
      {!guest.is_primary_guest && (
        <button className="ag-remove-btn" onClick={remove} disabled={removing} title="Remove guest">
          {removing ? '...' : ''}
        </button>
      )}
    </div>
  );
}

//  Main AdditionalGuests Panel 
export default function AdditionalGuests({ reservationId }) {
  const [guests,    setGuests]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const { setFlash } = useFlash();

  const load = useCallback(async () => {
    if (!reservationId) return;
    setLoading(true);
    try {
      const res = await apiRequest(`/reservations/${reservationId}/guests`);
      setGuests(res.data || []);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [reservationId, setFlash]);

  useEffect(() => { load(); }, [load]);

  function handleAdded(newGuest) {
    setGuests(g => [...g, newGuest]);
    setShowForm(false);
  }

  function handleRemoved(guestRowId) {
    setGuests(g => g.filter(x => x.reservation_guest_id !== guestRowId));
  }

  const adults   = guests.filter(g => g.age_category === 'ADULT').length;
  const children = guests.filter(g => g.age_category === 'CHILD').length;
  const infants  = guests.filter(g => g.age_category === 'INFANT').length;

  return (
    <div className="ag-panel">
      <div className="ag-panel-head">
        <h4 className="ag-panel-title">
           Guests
          <span className="ag-summary">{adults}A {children > 0 ? children+'C ' : ''}{infants > 0 ? infants+'I' : ''}</span>
        </h4>
        {!showForm && (
          <button className="ghost-button" style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            onClick={() => setShowForm(true)}>
            + Add Guest
          </button>
        )}
      </div>

      {loading && <p style={{ color: 'var(--text-soft)', fontSize: '0.82rem', padding: '8px 0' }}>Loading guests...</p>}

      <div className="ag-list">
        {guests.map(g => (
          <GuestRow
            key={g.reservation_guest_id}
            guest={{ ...g, reservation_id: reservationId }}
            onRemove={handleRemoved}
          />
        ))}
        {!loading && guests.length === 0 && (
          <p style={{ color: 'var(--text-soft)', fontSize: '0.82rem', padding: '8px 0' }}>No guests recorded yet.</p>
        )}
      </div>

      {showForm && (
        <AddGuestForm
          reservationId={reservationId}
          onAdded={handleAdded}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
