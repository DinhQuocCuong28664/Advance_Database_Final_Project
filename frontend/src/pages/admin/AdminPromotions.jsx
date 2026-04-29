import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

const PROMO_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_NIGHT', 'EARLY_BIRD', 'LAST_MINUTE', 'PACKAGE'];
const APPLIES_TO  = ['ROOM', 'PACKAGE', 'SERVICE', 'ALL'];

const TYPE_BADGE = {
  PERCENTAGE:   { bg: 'var(--promo-percentage-bg)', color: 'var(--promo-percentage-color)' },
  FIXED_AMOUNT: { bg: 'var(--promo-fixed-bg)', color: 'var(--promo-fixed-color)' },
  FREE_NIGHT:   { bg: 'var(--promo-freenight-bg)', color: 'var(--promo-freenight-color)' },
  EARLY_BIRD:   { bg: 'var(--promo-earlybird-bg)', color: 'var(--promo-earlybird-color)' },
  LAST_MINUTE:  { bg: 'var(--promo-lastminute-bg)', color: 'var(--promo-lastminute-color)' },
  PACKAGE:      { bg: 'var(--promo-package-bg)', color: 'var(--promo-package-color)' },
};

const EMPTY = {
  promotion_code: '', promotion_name: '', promotion_type: 'PERCENTAGE',
  discount_value: '', currency_code: 'USD', applies_to: 'ROOM',
  booking_start_date: '', booking_end_date: '',
  stay_start_date: '', stay_end_date: '',
  member_only_flag: false, min_nights: '', redeemable_points_cost: '', voucher_valid_days: '', description: '',
  hotel_id: '',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDiscount(p) {
  if (!p.discount_value) return 'Special offer';
  if (p.promotion_type === 'PERCENTAGE') return `${Number(p.discount_value)}% off`;
  return new Intl.NumberFormat('en-US', { style:'currency', currency: p.currency_code || 'USD' })
    .format(Number(p.discount_value));
}

export default function AdminPromotions({ hotels }) {
  const { setFlash } = useFlash();

  const [promos,     setPromos]     = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [filterHotel,setFilterHotel]= useState('');

  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const [editing,    setEditing]    = useState(null); // promo being edited inline
  const [editForm,   setEditForm]   = useState({});
  const [savingId,   setSavingId]   = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function loadPromos(hid) {
    setLoading(true);
    try {
      const qs = hid ? `?hotel_id=${hid}` : '';
      const p  = await apiRequest(`/promotions${qs}`);
      setPromos(p.data || []);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchPromotions() {
      setLoading(true);
      try {
        const qs = filterHotel ? `?hotel_id=${filterHotel}` : '';
        const payload = await apiRequest(`/promotions${qs}`);
        if (!cancelled) {
          setPromos(payload.data || []);
        }
      } catch (e) {
        if (!cancelled) {
          setFlash({ tone: 'error', text: e.message });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPromotions();
    return () => {
      cancelled = true;
    };
  }, [filterHotel, setFlash]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/promotions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          hotel_id:        form.hotel_id      ? Number(form.hotel_id)      : null,
          discount_value:  form.discount_value ? Number(form.discount_value) : null,
          min_nights:      form.min_nights     ? Number(form.min_nights)     : null,
          redeemable_points_cost: form.redeemable_points_cost ? Number(form.redeemable_points_cost) : null,
          voucher_valid_days: form.voucher_valid_days ? Number(form.voucher_valid_days) : null,
          member_only_flag:form.member_only_flag ? 1 : 0,
          booking_start_date: form.booking_start_date || undefined,
          booking_end_date:   form.booking_end_date   || undefined,
          stay_start_date:    form.stay_start_date    || undefined,
          stay_end_date:      form.stay_end_date      || undefined,
        }),
      });
      setFlash({ tone: 'success', text: `Promotion "${form.promotion_name}" created.` });
      setForm(EMPTY); setShowForm(false);
      await loadPromos(filterHotel);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setSubmitting(false); }
  }

  function startEdit(p) {
    setEditing(p.promotion_id);
    setEditForm({
      promotion_name:    p.promotion_name,
      discount_value:    p.discount_value   || '',
      booking_start_date:p.booking_start_date?.slice(0,10) || '',
      booking_end_date:  p.booking_end_date?.slice(0,10)   || '',
      stay_start_date:   p.stay_start_date?.slice(0,10)    || '',
      stay_end_date:     p.stay_end_date?.slice(0,10)      || '',
      member_only_flag:  !!p.member_only_flag,
      min_nights:        p.min_nights || '',
      redeemable_points_cost: p.redeemable_points_cost || '',
      voucher_valid_days: p.voucher_valid_days || '',
    });
  }

  async function handleSaveEdit(promoId) {
    setSavingId(promoId);
    try {
      await apiRequest(`/promotions/${promoId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editForm,
          discount_value: editForm.discount_value ? Number(editForm.discount_value) : null,
          min_nights:     editForm.min_nights      ? Number(editForm.min_nights)     : null,
          redeemable_points_cost: editForm.redeemable_points_cost ? Number(editForm.redeemable_points_cost) : null,
          voucher_valid_days: editForm.voucher_valid_days ? Number(editForm.voucher_valid_days) : null,
        }),
      });
      setFlash({ tone: 'success', text: 'Promotion updated.' });
      setEditing(null);
      await loadPromos(filterHotel);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setSavingId(null); }
  }

  async function handleDeactivate(p) {
    if (!window.confirm(`Deactivate "${p.promotion_name}"? This cannot be undone via UI.`)) return;
    setDeletingId(p.promotion_id);
    try {
      await apiRequest(`/promotions/${p.promotion_id}`, { method: 'DELETE' });
      setFlash({ tone: 'success', text: `"${p.promotion_name}" deactivated.` });
      await loadPromos(filterHotel);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setDeletingId(null); }
  }

  return (
    <section className="page-card page-card-wide" id="admin-promotions">

      {/* Header */}
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Promotions</p>
          <h2>Manage hotel promotions &amp; offers</h2>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New promotion'}
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="inventory-toolbar" style={{ marginBottom: 16 }}>
        <label>
          Hotel filter
          <select value={filterHotel}
            onChange={e => { setFilterHotel(e.target.value); loadPromos(e.target.value); }}>
            <option value="">All hotels</option>
            {hotels.map(h => <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>)}
          </select>
        </label>
        <button type="button" className="primary-button" onClick={() => loadPromos(filterHotel)} disabled={loading}>
          {loading ? 'Loading...' : ' Refresh'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form className="maint-new-form page-card" onSubmit={handleCreate}>
          <p className="page-eyebrow" style={{ marginBottom: 14 }}>New promotion</p>
          <div className="promo-form-grid">
            <label>
              Hotel scope
              <select value={form.hotel_id} onChange={e => setForm(f => ({ ...f, hotel_id: e.target.value }))}>
                <option value="">All hotels (global)</option>
                {hotels.map(h => <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>)}
              </select>
            </label>
            <label>
              Promo code *
              <input type="text" required value={form.promotion_code}
                onChange={e => setForm(f => ({ ...f, promotion_code: e.target.value.toUpperCase() }))}
                placeholder="SUMMER25" />
            </label>
            <label>
              Name *
              <input type="text" required value={form.promotion_name}
                onChange={e => setForm(f => ({ ...f, promotion_name: e.target.value }))}
                placeholder="Summer Sale 2026" />
            </label>
            <label>
              Type *
              <select value={form.promotion_type}
                onChange={e => setForm(f => ({ ...f, promotion_type: e.target.value }))}>
                {PROMO_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </label>
            <label>
              Discount value
              <input type="number" min="0" step="0.01" value={form.discount_value}
                onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                placeholder="e.g. 15 (%) or 500000 (fixed)" />
            </label>
            <label>
              Currency
              <input type="text" maxLength={3} value={form.currency_code}
                onChange={e => setForm(f => ({ ...f, currency_code: e.target.value.toUpperCase() }))} />
            </label>
            <label>
              Applies to
              <select value={form.applies_to}
                onChange={e => setForm(f => ({ ...f, applies_to: e.target.value }))}>
                {APPLIES_TO.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label>
              Min nights
              <input type="number" min="1" value={form.min_nights}
                onChange={e => setForm(f => ({ ...f, min_nights: e.target.value }))} placeholder="e.g. 2" />
            </label>
            <label>
              Points cost
              <input type="number" min="0" step="1" value={form.redeemable_points_cost}
                onChange={e => setForm(f => ({ ...f, redeemable_points_cost: e.target.value }))}
                placeholder="Optional loyalty redemption cost" />
            </label>
            <label>
              Voucher valid days
              <input type="number" min="1" step="1" value={form.voucher_valid_days}
                onChange={e => setForm(f => ({ ...f, voucher_valid_days: e.target.value }))}
                placeholder="e.g. 30" />
            </label>
            <label>
              Booking start *
              <input type="date" required value={form.booking_start_date}
                onChange={e => setForm(f => ({ ...f, booking_start_date: e.target.value }))} />
            </label>
            <label>
              Booking end *
              <input type="date" required value={form.booking_end_date}
                onChange={e => setForm(f => ({ ...f, booking_end_date: e.target.value }))} />
            </label>
            <label>
              Stay start
              <input type="date" value={form.stay_start_date}
                onChange={e => setForm(f => ({ ...f, stay_start_date: e.target.value }))} />
            </label>
            <label>
              Stay end
              <input type="date" value={form.stay_end_date}
                onChange={e => setForm(f => ({ ...f, stay_end_date: e.target.value }))} />
            </label>
            <label className="promo-form-wide" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
              <input type="checkbox" checked={form.member_only_flag}
                onChange={e => setForm(f => ({ ...f, member_only_flag: e.target.checked }))} />
              Members only
            </label>
            <label className="promo-form-wide">
              Description
              <textarea rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description shown to guests..." />
            </label>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
            <button type="button" className="ghost-button"
              onClick={() => { setShowForm(false); setForm(EMPTY); }}>Discard</button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create promotion'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading && <p className="fd-loading">Loading promotions...</p>}

      {!loading && promos.length === 0 && (
        <div className="svc-orders-empty">
          <span></span><p>No active promotions found.</p>
          <small>Create one above or adjust the hotel filter.</small>
        </div>
      )}

      {promos.length > 0 && (
        <div className="promo-list">
          {promos.map(p => {
            const badge = TYPE_BADGE[p.promotion_type] || {};
            const isEdit = editing === p.promotion_id;
            return (
              <article key={p.promotion_id} className="promo-card">

                {/* Top row */}
                <div className="promo-card-top">
                  <div className="promo-card-badges">
                    <span className="promo-type-badge" style={{ background: badge.bg, color: badge.color }}>
                      {p.promotion_type.replace(/_/g,' ')}
                    </span>
                    {p.member_only_flag ? (
                      <span className="promo-member-badge"> Members only</span>
                    ) : null}
                    {p.scope_type && (
                      <span className="promo-scope-badge">{p.scope_type}</span>
                    )}
                  </div>
                  <code className="promo-code-tag">{p.promotion_code}</code>
                </div>

                {!isEdit ? (
                  <>
                    <h3 className="promo-name">{p.promotion_name}</h3>
                    <p className="promo-discount">{fmtDiscount(p)}</p>
                    <div className="promo-meta">
                      <span> Book: {fmtDate(p.booking_start_date)}  {fmtDate(p.booking_end_date)}</span>
                      {p.stay_start_date && (
                        <span> Stay: {fmtDate(p.stay_start_date)}  {fmtDate(p.stay_end_date)}</span>
                      )}
                      {p.min_nights && <span> Min {p.min_nights} nights</span>}
                      {p.redeemable_points_cost && <span> {Number(p.redeemable_points_cost).toLocaleString()} pts</span>}
                      {p.voucher_valid_days && <span> Voucher {p.voucher_valid_days} days</span>}
                      {p.scope_hotel_name && <span> {p.scope_hotel_name}</span>}
                    </div>
                    <div className="promo-card-actions">
                      <button type="button" className="ghost-button" onClick={() => startEdit(p)}>
                         Edit
                      </button>
                      <button type="button" className="maint-deactivate-btn"
                        disabled={deletingId === p.promotion_id}
                        onClick={() => handleDeactivate(p)}>
                        {deletingId === p.promotion_id ? 'Deactivating...' : 'Deactivate'}
                      </button>
                    </div>
                  </>
                ) : (
                  /* Inline edit form */
                  <div className="promo-edit-form">
                    <div className="promo-form-grid">
                      <label>
                        Name
                        <input type="text" value={editForm.promotion_name}
                          onChange={e => setEditForm(f => ({ ...f, promotion_name: e.target.value }))} />
                      </label>
                      <label>
                        Discount value
                        <input type="number" value={editForm.discount_value}
                          onChange={e => setEditForm(f => ({ ...f, discount_value: e.target.value }))} />
                      </label>
                      <label>
                        Booking start
                        <input type="date" value={editForm.booking_start_date}
                          onChange={e => setEditForm(f => ({ ...f, booking_start_date: e.target.value }))} />
                      </label>
                      <label>
                        Booking end
                        <input type="date" value={editForm.booking_end_date}
                          onChange={e => setEditForm(f => ({ ...f, booking_end_date: e.target.value }))} />
                      </label>
                      <label>
                        Stay start
                        <input type="date" value={editForm.stay_start_date}
                          onChange={e => setEditForm(f => ({ ...f, stay_start_date: e.target.value }))} />
                      </label>
                      <label>
                        Stay end
                        <input type="date" value={editForm.stay_end_date}
                          onChange={e => setEditForm(f => ({ ...f, stay_end_date: e.target.value }))} />
                      </label>
                      <label>
                        Min nights
                        <input type="number" min="1" value={editForm.min_nights}
                          onChange={e => setEditForm(f => ({ ...f, min_nights: e.target.value }))} />
                      </label>
                      <label>
                        Points cost
                        <input type="number" min="0" value={editForm.redeemable_points_cost}
                          onChange={e => setEditForm(f => ({ ...f, redeemable_points_cost: e.target.value }))} />
                      </label>
                      <label>
                        Voucher valid days
                        <input type="number" min="1" value={editForm.voucher_valid_days}
                          onChange={e => setEditForm(f => ({ ...f, voucher_valid_days: e.target.value }))} />
                      </label>
                      <label className="promo-form-wide" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                        <input type="checkbox" checked={editForm.member_only_flag}
                          onChange={e => setEditForm(f => ({ ...f, member_only_flag: e.target.checked }))} />
                        Members only
                      </label>
                    </div>
                    <div style={{ display:'flex', gap:10, marginTop:12 }}>
                      <button type="button" className="ghost-button" onClick={() => setEditing(null)}>Cancel</button>
                      <button type="button" className="primary-button"
                        disabled={savingId === p.promotion_id}
                        onClick={() => handleSaveEdit(p.promotion_id)}>
                        {savingId === p.promotion_id ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
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
