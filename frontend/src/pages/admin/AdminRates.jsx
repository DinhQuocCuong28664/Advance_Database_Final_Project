import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useFlash } from '../../context/FlashContext';
import '../../styles/AdminRates.css';

const RATE_PLAN_TYPES = ['BAR', 'NON_REFUNDABLE', 'MEMBER', 'PACKAGE', 'CORPORATE', 'PROMO'];
const MEAL_INCLUSIONS = ['ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE'];
const RATE_PLAN_STATUSES = ['ACTIVE', 'INACTIVE'];

function formatLabel(value) {
  if (!value) return '-';
  return String(value).replace(/_/g, ' ');
}

function fmtCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Number(value || 0));
}

function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'short' }) : '-';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function asNullableNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildCreatePlanForm(hotelId = '') {
  return {
    hotel_id: hotelId ? String(hotelId) : '',
    rate_plan_code: '',
    rate_plan_name: '',
    rate_plan_type: 'BAR',
    meal_inclusion: 'ROOM_ONLY',
    is_refundable: true,
    requires_prepayment: false,
    min_advance_booking_days: '',
    max_advance_booking_days: '',
    effective_from: today(),
    effective_to: '',
  };
}

function buildEditPlanForm(plan) {
  return {
    rate_plan_name: plan.rate_plan_name || '',
    rate_plan_type: plan.rate_plan_type || 'BAR',
    meal_inclusion: plan.meal_inclusion || 'ROOM_ONLY',
    is_refundable: Boolean(plan.is_refundable),
    requires_prepayment: Boolean(plan.requires_prepayment),
    min_advance_booking_days: plan.min_advance_booking_days ?? '',
    max_advance_booking_days: plan.max_advance_booking_days ?? '',
    effective_from: plan.effective_from?.slice(0, 10) || '',
    effective_to: plan.effective_to?.slice(0, 10) || '',
    status: plan.status || 'ACTIVE',
  };
}

function validatePlanWindow(form, { requireHotel = false, requireCode = false } = {}) {
  if (requireHotel && !form.hotel_id) {
    return 'Select a hotel for this rate plan.';
  }
  if (requireCode && !String(form.rate_plan_code || '').trim()) {
    return 'Rate plan code is required.';
  }
  if (!String(form.rate_plan_name || '').trim()) {
    return 'Rate plan name is required.';
  }
  if (!String(form.rate_plan_type || '').trim()) {
    return 'Rate plan type is required.';
  }
  if (!String(form.effective_from || '').trim()) {
    return 'Effective from date is required.';
  }

  const minDays = asNullableNumber(form.min_advance_booking_days);
  const maxDays = asNullableNumber(form.max_advance_booking_days);

  if (minDays != null && minDays < 0) {
    return 'Minimum advance booking days cannot be negative.';
  }
  if (maxDays != null && maxDays < 0) {
    return 'Maximum advance booking days cannot be negative.';
  }
  if (minDays != null && maxDays != null && minDays > maxDays) {
    return 'Max advance booking days must be greater than or equal to min advance booking days.';
  }
  if (form.effective_to && form.effective_to < form.effective_from) {
    return 'Effective to date must be after effective from date.';
  }

  return null;
}

function toCreatePlanPayload(form) {
  return {
    hotel_id: Number(form.hotel_id),
    rate_plan_code: String(form.rate_plan_code).trim().toUpperCase(),
    rate_plan_name: String(form.rate_plan_name).trim(),
    rate_plan_type: form.rate_plan_type,
    meal_inclusion: form.meal_inclusion,
    is_refundable: Boolean(form.is_refundable),
    requires_prepayment: Boolean(form.requires_prepayment),
    min_advance_booking_days: asNullableNumber(form.min_advance_booking_days),
    max_advance_booking_days: asNullableNumber(form.max_advance_booking_days),
    effective_from: form.effective_from || null,
    effective_to: form.effective_to || null,
  };
}

function toUpdatePlanPayload(form) {
  return {
    rate_plan_name: String(form.rate_plan_name).trim(),
    rate_plan_type: form.rate_plan_type,
    meal_inclusion: form.meal_inclusion,
    is_refundable: Boolean(form.is_refundable),
    requires_prepayment: Boolean(form.requires_prepayment),
    min_advance_booking_days: asNullableNumber(form.min_advance_booking_days),
    max_advance_booking_days: asNullableNumber(form.max_advance_booking_days),
    effective_from: form.effective_from || null,
    effective_to: form.effective_to || null,
    status: form.status,
  };
}

function planFlagText(plan) {
  return [
    plan.is_refundable ? 'Refundable' : 'Non-refundable',
    plan.requires_prepayment ? 'Prepayment required' : 'Pay at stay',
    formatLabel(plan.meal_inclusion),
  ];
}

function RateCell({ rate, currency, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  function startEdit() {
    setValue(String(parseFloat(rate.final_rate)));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  }

  async function commit() {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setEditing(false);
      return;
    }
    if (parsed === parseFloat(rate.final_rate)) {
      setEditing(false);
      return;
    }

    await onSave(rate.room_rate_id, parsed, parseFloat(rate.final_rate));
    setEditing(false);
  }

  if (saving) {
    return <span className="rate-cell rate-cell--saving">saving...</span>;
  }

  if (editing) {
    return (
      <span className="rate-cell rate-cell--editing">
        <input
          ref={inputRef}
          type="number"
          min="1"
          step="0.01"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') setEditing(false);
          }}
          onBlur={commit}
          className="rate-input"
        />
      </span>
    );
  }

  return (
    <span
      className={`rate-cell ${rate.is_override ? 'rate-cell--override' : ''} ${rate.alert_count > 0 ? 'rate-cell--alert' : ''}`}
      onClick={startEdit}
      title="Click to edit"
    >
      {fmtCurrency(rate.final_rate, currency)}
      {rate.alert_count > 0 ? <span className="rate-alert-dot" title="Price Guard triggered">!</span> : null}
    </span>
  );
}

function ConfirmModal({ pending, onConfirm, onCancel, saving }) {
  if (!pending) return null;

  const changePercent = Math.abs(((pending.newRate - pending.oldRate) / pending.oldRate) * 100).toFixed(1);

  return (
    <div className="pm-overlay" onClick={onCancel}>
      <div className="pm-dialog pm-dialog--light" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 8 }}>!</div>
        <h3 className="pm-title" style={{ color: '#92400e', textAlign: 'center' }}>Price Guard warning</h3>
        <p style={{ color: '#555', margin: '12px 0', textAlign: 'center', lineHeight: 1.5 }}>
          This rate change is <strong>{changePercent}%</strong> and exceeds the 50% threshold.
          <br />
          <span style={{ fontSize: '0.85rem', color: '#888' }}>
            {pending.roomTypeName} | {fmtDate(pending.rateDate)}
          </span>
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fef9c3', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ color: '#713f12' }}>Old rate</span>
          <strong>{fmtCurrency(pending.oldRate, pending.currency)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#dcfce7', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <span style={{ color: '#14532d' }}>New rate</span>
          <strong>{fmtCurrency(pending.newRate, pending.currency)}</strong>
        </div>
        <div className="pm-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="button" onClick={onConfirm} disabled={saving} style={{ background: '#d97706' }}>
            {saving ? 'Saving...' : 'Override anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRates({ hotels = [] }) {
  const { setFlash } = useFlash();
  const { authSession } = useAuth();

  const currentUserId = authSession?.user?.user_id || null;
  const [hotelId, setHotelId] = useState('');
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(inDays(14));
  const [roomTypeFilter, setRoomTypeFilter] = useState('');

  const [planStatusFilter, setPlanStatusFilter] = useState('ACTIVE');
  const [planTypeFilter, setPlanTypeFilter] = useState('');

  const [ratePlans, setRatePlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState(() => buildCreatePlanForm(hotels[0]?.hotel_id || ''));
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editPlanForm, setEditPlanForm] = useState(null);
  const [savingPlanId, setSavingPlanId] = useState(null);
  const [deletingPlanId, setDeletingPlanId] = useState(null);

  const [roomTypes, setRoomTypes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [searchedRates, setSearchedRates] = useState(false);
  const [savingRateId, setSavingRateId] = useState(null);
  const [confirmPending, setConfirmPending] = useState(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  const planCounts = {
    active: ratePlans.filter((plan) => plan.status === 'ACTIVE').length,
    inactive: ratePlans.filter((plan) => plan.status === 'INACTIVE').length,
    linked: ratePlans.filter((plan) => Number(plan.rate_count || 0) > 0).length,
  };

  const roomTypeOptions = roomTypes.map((roomType) => ({
    room_type_id: roomType.room_type_id,
    room_type_name: roomType.room_type_name,
  }));

  const alertCurrency = roomTypes[0]?.currency_code || 'USD';

  const loadRateAlerts = useCallback(async () => {
    const payload = await apiRequest('/admin/rates/alerts').catch(() => ({ data: [] }));
    setAlerts(payload.data || []);
  }, []);

  const loadRatePlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const qs = new URLSearchParams();
      if (hotelId) qs.set('hotel_id', hotelId);
      if (planStatusFilter) qs.set('status', planStatusFilter);
      if (planTypeFilter) qs.set('type', planTypeFilter);

      const query = qs.toString();
      const payload = await apiRequest(query ? `/admin/rate-plans?${query}` : '/admin/rate-plans');
      setRatePlans(payload.data || []);
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setLoadingPlans(false);
    }
  }, [hotelId, planStatusFilter, planTypeFilter, setFlash]);

  const loadRates = useCallback(async () => {
    setLoadingRates(true);
    try {
      const qs = new URLSearchParams();
      if (hotelId) qs.set('hotel_id', hotelId);
      if (dateFrom) qs.set('date_from', dateFrom);
      if (dateTo) qs.set('date_to', dateTo);
      if (roomTypeFilter) qs.set('room_type_id', roomTypeFilter);

      const query = qs.toString();
      const payload = await apiRequest(query ? `/admin/rates?${query}` : '/admin/rates');
      setRoomTypes(payload.room_types || []);
      setSearchedRates(true);
      await loadRateAlerts();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setLoadingRates(false);
    }
  }, [hotelId, dateFrom, dateTo, roomTypeFilter, loadRateAlerts, setFlash]);

  useEffect(() => {
    loadRatePlans();
  }, [loadRatePlans]);

  useEffect(() => {
    loadRateAlerts();
  }, [loadRateAlerts]);

  useEffect(() => {
    if (showPlanForm) return;
    if (planForm.hotel_id) return;

    const nextHotelId = hotelId || hotels[0]?.hotel_id || '';
    if (nextHotelId) {
      setPlanForm(buildCreatePlanForm(nextHotelId));
    }
  }, [hotelId, hotels, planForm.hotel_id, showPlanForm]);

  function openPlanForm() {
    setShowPlanForm((current) => {
      const next = !current;
      if (next) {
        setPlanForm(buildCreatePlanForm(hotelId || hotels[0]?.hotel_id || ''));
        setEditingPlanId(null);
        setEditPlanForm(null);
      }
      return next;
    });
  }

  function startEditPlan(plan) {
    setShowPlanForm(false);
    setEditingPlanId(plan.rate_plan_id);
    setEditPlanForm(buildEditPlanForm(plan));
  }

  function cancelEditPlan() {
    setEditingPlanId(null);
    setEditPlanForm(null);
  }

  async function handleCreatePlan(event) {
    event.preventDefault();

    const validationError = validatePlanWindow(planForm, { requireHotel: true, requireCode: true });
    if (validationError) {
      setFlash({ tone: 'error', text: validationError });
      return;
    }

    setSubmittingPlan(true);
    try {
      await apiRequest('/admin/rate-plans', {
        method: 'POST',
        body: JSON.stringify(toCreatePlanPayload(planForm)),
      });

      setFlash({ tone: 'success', text: `Rate plan "${planForm.rate_plan_name}" created.` });
      setPlanForm(buildCreatePlanForm(hotelId || hotels[0]?.hotel_id || ''));
      setShowPlanForm(false);
      await loadRatePlans();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setSubmittingPlan(false);
    }
  }

  async function handleSavePlan(planId) {
    if (!editPlanForm) return;

    const validationError = validatePlanWindow(editPlanForm);
    if (validationError) {
      setFlash({ tone: 'error', text: validationError });
      return;
    }

    setSavingPlanId(planId);
    try {
      await apiRequest(`/admin/rate-plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify(toUpdatePlanPayload(editPlanForm)),
      });

      setFlash({ tone: 'success', text: 'Rate plan updated.' });
      cancelEditPlan();
      await loadRatePlans();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setSavingPlanId(null);
    }
  }

  async function handleDeactivatePlan(plan) {
    if (!window.confirm(`Deactivate "${plan.rate_plan_name}"?`)) return;

    setDeletingPlanId(plan.rate_plan_id);
    try {
      await apiRequest(`/admin/rate-plans/${plan.rate_plan_id}`, {
        method: 'DELETE',
      });

      setFlash({ tone: 'success', text: `"${plan.rate_plan_name}" deactivated.` });
      if (editingPlanId === plan.rate_plan_id) {
        cancelEditPlan();
      }
      await loadRatePlans();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setDeletingPlanId(null);
    }
  }

  async function doSaveRate(rateId, newRate, currency) {
    setSavingRateId(rateId);
    try {
      const payload = await apiRequest(`/admin/rates/${rateId}`, {
        method: 'PUT',
        body: JSON.stringify({
          final_rate: newRate,
          price_source: 'MANUAL_OVERRIDE',
          updated_by: currentUserId,
        }),
      });

      const result = payload.data || {};
      const warning = result.price_guard_triggered;
      const changeText = typeof result.change_percent === 'number'
        ? ` (${result.change_percent.toFixed(1)}% change)`
        : '';

      setFlash({
        tone: warning ? 'warning' : 'success',
        text: warning
          ? `Rate updated and Price Guard was triggered${changeText}.`
          : `Rate updated to ${fmtCurrency(newRate, currency)}.`,
      });

      await loadRates();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setSavingRateId(null);
    }
  }

  async function handleSaveRate(rateId, newRate, oldRate) {
    const changePercent = Math.abs(((newRate - oldRate) / oldRate) * 100);
    let selectedRate = null;

    for (const roomType of roomTypes) {
      const match = roomType.rates.find((rate) => rate.room_rate_id === rateId);
      if (match) {
        selectedRate = { roomType, rate: match };
        break;
      }
    }

    if (!selectedRate) return;

    if (changePercent > 50) {
      setConfirmPending({
        rateId,
        newRate,
        oldRate,
        roomTypeName: selectedRate.roomType.room_type_name,
        rateDate: selectedRate.rate.rate_date,
        currency: selectedRate.roomType.currency_code,
      });
      return;
    }

    await doSaveRate(rateId, newRate, selectedRate.roomType.currency_code);
  }

  async function handleConfirmOverride() {
    if (!confirmPending) return;

    setConfirmSaving(true);
    await doSaveRate(confirmPending.rateId, confirmPending.newRate, confirmPending.currency);
    setConfirmSaving(false);
    setConfirmPending(null);
  }

  return (
    <section className="page-card page-card-wide" id="admin-rates">
      <div className="admin-section-head" style={{ marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Revenue management</p>
          <h2>Rate plans and nightly pricing</h2>
          <p className="page-text">
            Manage the products guests book first, then adjust the daily rates those plans sell at.
          </p>
        </div>
        {alerts.length > 0 ? (
          <span className="rate-alerts-pill">{alerts.length} Price Guard alert{alerts.length > 1 ? 's' : ''}</span>
        ) : null}
      </div>

      <div className="rate-admin-stack">
        <article className="rate-subsection">
          <div className="admin-section-head">
            <div>
              <p className="page-eyebrow">Rate plans</p>
              <h3 className="rate-subsection-title">Sellable pricing products</h3>
              <p className="page-text">Create and maintain BAR, member, package, corporate, and promo plans per hotel.</p>
            </div>
            <button type="button" className="primary-button" onClick={openPlanForm}>
              {showPlanForm ? 'Cancel' : '+ New rate plan'}
            </button>
          </div>

          <div className="rate-toolbar">
            <label>
              Hotel
              <select value={hotelId} onChange={(event) => setHotelId(event.target.value)}>
                <option value="">All hotels</option>
                {hotels.map((hotel) => (
                  <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select value={planStatusFilter} onChange={(event) => setPlanStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {RATE_PLAN_STATUSES.map((status) => (
                  <option key={status} value={status}>{formatLabel(status)}</option>
                ))}
              </select>
            </label>

            <label>
              Type
              <select value={planTypeFilter} onChange={(event) => setPlanTypeFilter(event.target.value)}>
                <option value="">All types</option>
                {RATE_PLAN_TYPES.map((type) => (
                  <option key={type} value={type}>{formatLabel(type)}</option>
                ))}
              </select>
            </label>

            <button type="button" className="primary-button" onClick={loadRatePlans} disabled={loadingPlans}>
              {loadingPlans ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {ratePlans.length > 0 ? (
            <div className="rate-plan-stats">
              <span className="rate-plan-stat"><strong>{ratePlans.length}</strong> plans</span>
              <span className="rate-plan-stat rate-plan-stat--active"><strong>{planCounts.active}</strong> active</span>
              <span className="rate-plan-stat rate-plan-stat--inactive"><strong>{planCounts.inactive}</strong> inactive</span>
              <span className="rate-plan-stat rate-plan-stat--linked"><strong>{planCounts.linked}</strong> linked to room rates</span>
            </div>
          ) : null}

          {showPlanForm ? (
            <form className="maint-new-form page-card" onSubmit={handleCreatePlan}>
              <p className="page-eyebrow" style={{ marginBottom: 14 }}>New rate plan</p>
              <div className="rate-plan-form-grid">
                <label>
                  Hotel *
                  <select
                    value={planForm.hotel_id}
                    onChange={(event) => setPlanForm((current) => ({ ...current, hotel_id: event.target.value }))}
                    required
                  >
                    <option value="">Select hotel</option>
                    {hotels.map((hotel) => (
                      <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Plan code *
                  <input
                    type="text"
                    value={planForm.rate_plan_code}
                    onChange={(event) => setPlanForm((current) => ({ ...current, rate_plan_code: event.target.value.toUpperCase() }))}
                    placeholder="BAR-FLEX"
                    required
                  />
                </label>

                <label className="rate-plan-wide">
                  Plan name *
                  <input
                    type="text"
                    value={planForm.rate_plan_name}
                    onChange={(event) => setPlanForm((current) => ({ ...current, rate_plan_name: event.target.value }))}
                    placeholder="Best Available Flexible Rate"
                    required
                  />
                </label>

                <label>
                  Plan type *
                  <select
                    value={planForm.rate_plan_type}
                    onChange={(event) => setPlanForm((current) => ({ ...current, rate_plan_type: event.target.value }))}
                  >
                    {RATE_PLAN_TYPES.map((type) => (
                      <option key={type} value={type}>{formatLabel(type)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Meal inclusion
                  <select
                    value={planForm.meal_inclusion}
                    onChange={(event) => setPlanForm((current) => ({ ...current, meal_inclusion: event.target.value }))}
                  >
                    {MEAL_INCLUSIONS.map((meal) => (
                      <option key={meal} value={meal}>{formatLabel(meal)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Effective from *
                  <input
                    type="date"
                    value={planForm.effective_from}
                    onChange={(event) => setPlanForm((current) => ({ ...current, effective_from: event.target.value }))}
                    required
                  />
                </label>

                <label>
                  Effective to
                  <input
                    type="date"
                    value={planForm.effective_to}
                    onChange={(event) => setPlanForm((current) => ({ ...current, effective_to: event.target.value }))}
                  />
                </label>

                <label>
                  Min advance days
                  <input
                    type="number"
                    min="0"
                    value={planForm.min_advance_booking_days}
                    onChange={(event) => setPlanForm((current) => ({ ...current, min_advance_booking_days: event.target.value }))}
                    placeholder="0"
                  />
                </label>

                <label>
                  Max advance days
                  <input
                    type="number"
                    min="0"
                    value={planForm.max_advance_booking_days}
                    onChange={(event) => setPlanForm((current) => ({ ...current, max_advance_booking_days: event.target.value }))}
                    placeholder="30"
                  />
                </label>

                <label className="rate-plan-checkbox">
                  <input
                    type="checkbox"
                    checked={planForm.is_refundable}
                    onChange={(event) => setPlanForm((current) => ({ ...current, is_refundable: event.target.checked }))}
                  />
                  Refundable plan
                </label>

                <label className="rate-plan-checkbox">
                  <input
                    type="checkbox"
                    checked={planForm.requires_prepayment}
                    onChange={(event) => setPlanForm((current) => ({ ...current, requires_prepayment: event.target.checked }))}
                  />
                  Requires prepayment
                </label>
              </div>

              <div className="rate-plan-form-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setShowPlanForm(false);
                    setPlanForm(buildCreatePlanForm(hotelId || hotels[0]?.hotel_id || ''));
                  }}
                >
                  Discard
                </button>
                <button type="submit" className="primary-button" disabled={submittingPlan}>
                  {submittingPlan ? 'Creating...' : 'Create rate plan'}
                </button>
              </div>
            </form>
          ) : null}

          {loadingPlans ? <p className="fd-loading">Loading rate plans...</p> : null}

          {!loadingPlans && ratePlans.length === 0 ? (
            <div className="svc-orders-empty">
              <span>Plans</span>
              <p>No rate plans found for the selected filters.</p>
              <small>Create a new plan or widen the filters above.</small>
            </div>
          ) : null}

          {!loadingPlans && ratePlans.length > 0 ? (
            <div className="rate-plan-list">
              {ratePlans.map((plan) => {
                const isEditing = editingPlanId === plan.rate_plan_id && editPlanForm;

                return (
                  <article key={plan.rate_plan_id} className="rate-plan-card">
                    <div className="rate-plan-card-top">
                      <div className="rate-plan-badges">
                        <span className="rate-plan-type-badge">{formatLabel(plan.rate_plan_type)}</span>
                        <span className={`rate-plan-status-badge ${plan.status === 'ACTIVE' ? 'rate-plan-status-badge--active' : 'rate-plan-status-badge--inactive'}`}>
                          {formatLabel(plan.status)}
                        </span>
                        <span className="rate-plan-code-tag">{plan.rate_plan_code}</span>
                      </div>
                      <span className="rate-plan-rate-count">{Number(plan.rate_count || 0)} linked rate{Number(plan.rate_count || 0) === 1 ? '' : 's'}</span>
                    </div>

                    {!isEditing ? (
                      <>
                        <h3 className="rate-plan-name">{plan.rate_plan_name}</h3>
                        <div className="rate-plan-meta">
                          <span>{plan.hotel_name}</span>
                          <span>{fmtDate(plan.effective_from)} to {fmtDate(plan.effective_to)}</span>
                          <span>{planFlagText(plan).join(' | ')}</span>
                          <span>
                            Advance window: {plan.min_advance_booking_days ?? '-'} to {plan.max_advance_booking_days ?? '-'} days
                          </span>
                        </div>
                        <div className="rate-plan-actions">
                          <button type="button" className="ghost-button" onClick={() => startEditPlan(plan)}>
                            Edit plan
                          </button>
                          <button
                            type="button"
                            className="maint-deactivate-btn"
                            onClick={() => handleDeactivatePlan(plan)}
                            disabled={deletingPlanId === plan.rate_plan_id}
                          >
                            {deletingPlanId === plan.rate_plan_id ? 'Deactivating...' : 'Deactivate'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="rate-plan-edit-form">
                        <div className="rate-plan-readonly">
                          <span><strong>Hotel:</strong> {plan.hotel_name}</span>
                          <span><strong>Code:</strong> {plan.rate_plan_code}</span>
                        </div>

                        <div className="rate-plan-form-grid">
                          <label className="rate-plan-wide">
                            Plan name *
                            <input
                              type="text"
                              value={editPlanForm.rate_plan_name}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, rate_plan_name: event.target.value }))}
                            />
                          </label>

                          <label>
                            Plan type
                            <select
                              value={editPlanForm.rate_plan_type}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, rate_plan_type: event.target.value }))}
                            >
                              {RATE_PLAN_TYPES.map((type) => (
                                <option key={type} value={type}>{formatLabel(type)}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            Status
                            <select
                              value={editPlanForm.status}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, status: event.target.value }))}
                            >
                              {RATE_PLAN_STATUSES.map((status) => (
                                <option key={status} value={status}>{formatLabel(status)}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            Meal inclusion
                            <select
                              value={editPlanForm.meal_inclusion}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, meal_inclusion: event.target.value }))}
                            >
                              {MEAL_INCLUSIONS.map((meal) => (
                                <option key={meal} value={meal}>{formatLabel(meal)}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            Effective from
                            <input
                              type="date"
                              value={editPlanForm.effective_from}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, effective_from: event.target.value }))}
                            />
                          </label>

                          <label>
                            Effective to
                            <input
                              type="date"
                              value={editPlanForm.effective_to}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, effective_to: event.target.value }))}
                            />
                          </label>

                          <label>
                            Min advance days
                            <input
                              type="number"
                              min="0"
                              value={editPlanForm.min_advance_booking_days}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, min_advance_booking_days: event.target.value }))}
                            />
                          </label>

                          <label>
                            Max advance days
                            <input
                              type="number"
                              min="0"
                              value={editPlanForm.max_advance_booking_days}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, max_advance_booking_days: event.target.value }))}
                            />
                          </label>

                          <label className="rate-plan-checkbox">
                            <input
                              type="checkbox"
                              checked={editPlanForm.is_refundable}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, is_refundable: event.target.checked }))}
                            />
                            Refundable plan
                          </label>

                          <label className="rate-plan-checkbox">
                            <input
                              type="checkbox"
                              checked={editPlanForm.requires_prepayment}
                              onChange={(event) => setEditPlanForm((current) => ({ ...current, requires_prepayment: event.target.checked }))}
                            />
                            Requires prepayment
                          </label>
                        </div>

                        <div className="rate-plan-form-actions">
                          <button type="button" className="ghost-button" onClick={cancelEditPlan}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => handleSavePlan(plan.rate_plan_id)}
                            disabled={savingPlanId === plan.rate_plan_id}
                          >
                            {savingPlanId === plan.rate_plan_id ? 'Saving...' : 'Save changes'}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : null}
        </article>

        <article className="rate-subsection">
          <div className="admin-section-head">
            <div>
              <p className="page-eyebrow">Nightly rates</p>
              <h3 className="rate-subsection-title">Daily price editor</h3>
              <p className="page-text">
                Load room rates for a date range and edit the final sell rate inline. Changes above 50% trigger Price Guard.
              </p>
            </div>
            {alerts.length > 0 ? (
              <span className="rate-alerts-pill">{alerts.length} Price Guard alert{alerts.length > 1 ? 's' : ''}</span>
            ) : null}
          </div>

          {alerts.length > 0 ? (
            <div className="rate-alerts-panel">
              <p className="rate-alerts-title">Recent Price Guard alerts</p>
              <div className="rate-alerts-list">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.rate_change_log_id} className="rate-alert-row">
                    <span className="rate-alert-hotel">{alert.hotel_name}</span>
                    <span className="rate-alert-type">{alert.room_type_name}</span>
                    <span className="rate-alert-date">{fmtDate(alert.rate_date)}</span>
                    <span className="rate-alert-change">
                      {fmtCurrency(alert.old_rate, alertCurrency)} {'?'} {fmtCurrency(alert.new_rate, alertCurrency)}
                      <em> ({Number(alert.change_percent || 0).toFixed(1)}%)</em>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rate-toolbar">
            <label>
              Hotel
              <select value={hotelId} onChange={(event) => setHotelId(event.target.value)}>
                <option value="">All hotels</option>
                {hotels.map((hotel) => (
                  <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
                ))}
              </select>
            </label>

            <label>
              Date from
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>

            <label>
              Date to
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>

            <label>
              Room type
              <select value={roomTypeFilter} onChange={(event) => setRoomTypeFilter(event.target.value)} disabled={roomTypeOptions.length === 0}>
                <option value="">All room types</option>
                {roomTypeOptions.map((roomType) => (
                  <option key={roomType.room_type_id} value={roomType.room_type_id}>{roomType.room_type_name}</option>
                ))}
              </select>
            </label>

            <button type="button" className="primary-button" onClick={loadRates} disabled={loadingRates}>
              {loadingRates ? 'Loading...' : 'Load rates'}
            </button>
          </div>

          {loadingRates ? <p className="fd-loading">Loading rates...</p> : null}

          {!loadingRates && !searchedRates ? (
            <div className="svc-orders-empty">
              <span>Rates</span>
              <p>Select a hotel and date range, then load nightly rates.</p>
              <small>Use the room type filter after at least one load.</small>
            </div>
          ) : null}

          {!loadingRates && searchedRates && roomTypes.length === 0 ? (
            <div className="svc-orders-empty">
              <span>Empty</span>
              <p>No rate rows matched the selected filters.</p>
              <small>Try another hotel, wider dates, or clear the room type filter.</small>
            </div>
          ) : null}

          {!loadingRates && roomTypes.map((roomType) => (
            <div key={roomType.room_type_id} className="rate-type-block">
              <div className="rate-type-header">
                <h3 className="rate-type-name">{roomType.room_type_name}</h3>
                <span className="rate-type-meta">
                  {roomType.hotel_name} | {roomType.rates.length} day{roomType.rates.length === 1 ? '' : 's'} | {roomType.currency_code}
                </span>
              </div>

              <div className="rate-grid-wrap">
                <table className="rate-grid-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Base rate</th>
                      <th>Final rate</th>
                      <th>Override</th>
                      <th>Source</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomType.rates.map((rate) => (
                      <tr key={rate.room_rate_id} className={`rate-grid-row ${rate.alert_count > 0 ? 'rate-grid-row--alert' : ''}`}>
                        <td className="rate-date-cell">{fmtDate(rate.rate_date)}</td>
                        <td className="rate-base-cell">{fmtCurrency(rate.base_rate, roomType.currency_code)}</td>
                        <td>
                          <RateCell
                            rate={rate}
                            currency={roomType.currency_code}
                            onSave={handleSaveRate}
                            saving={savingRateId === rate.room_rate_id}
                          />
                        </td>
                        <td>
                          {rate.is_override ? (
                            <span className="rate-badge rate-badge--override">Override</span>
                          ) : (
                            <span className="rate-badge rate-badge--auto">Auto</span>
                          )}
                        </td>
                        <td className="rate-source-cell">{rate.price_source || '-'}</td>
                        <td className="rate-updated-cell">{fmtDate(rate.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </article>
      </div>

      <ConfirmModal
        pending={confirmPending}
        onConfirm={handleConfirmOverride}
        onCancel={() => setConfirmPending(null)}
        saving={confirmSaving}
      />
    </section>
  );
}
