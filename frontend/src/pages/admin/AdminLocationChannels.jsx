import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

//  Helpers 
const fmtCurrency = (v) =>
  v ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v) : '';

const LOCATION_ICONS = {
  CONTINENT: '🌐',
  COUNTRY:   '🏳️',
  REGION:    '🗺️',
  CITY:      '🏙️',
  DISTRICT:  '📍',
};

const CHANNEL_TYPE_COLORS = {
  OTA:    { bg: 'var(--channel-ota-bg)', color: 'var(--channel-ota-color)' },
  DIRECT: { bg: 'var(--channel-direct-bg)', color: 'var(--channel-direct-color)' },
  GDS:    { bg: 'var(--channel-gds-bg)', color: 'var(--channel-gds-color)' },
  AGENT:  { bg: 'var(--channel-agent-bg)', color: 'var(--channel-agent-color)' },
  WALK_IN:{ bg: 'var(--channel-walkin-bg)', color: 'var(--channel-walkin-color)' },
};
const channelStyle = (t) => CHANNEL_TYPE_COLORS[t] || { bg: 'var(--channel-default-bg)', color: 'var(--channel-default-color)' };

//  Location Tree Node 
function TreeNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children?.length > 0;
  const icon = LOCATION_ICONS[node.location_type] || '';
  const indent = depth * 20;

  return (
    <div className="loc-node">
      <div
        className={`loc-node-row ${hasChildren ? 'loc-node-row--clickable' : ''}`}
        style={{ paddingLeft: 16 + indent }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        <span className="loc-node-toggle">
          {hasChildren ? (open ? '▾' : '▸') : <span style={{ width: 12, display: 'inline-block' }} />}
        </span>
        <span className="loc-node-icon">{icon}</span>
        <span className="loc-node-name">{node.location_name}</span>
        {node.iso_code && <span className="loc-node-code">{node.iso_code}</span>}
        <span className="loc-node-type">{node.location_type}</span>
        {node.hotel_count > 0 && (
          <span className="loc-node-hotels">🏨 {node.hotel_count}</span>
        )}
      </div>
      {open && hasChildren && (
        <div className="loc-node-children">
          {node.children.map(c => <TreeNode key={c.location_id} node={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

//  Booking Channel Table 
function ChannelTable({ channels }) {
  return (
    <div className="chan-table-wrap">
      <table className="pay-hist-table">
        <thead>
          <tr>
            <th>Channel</th>
            <th>Type</th>
            <th>Commission</th>
            <th>Reservations</th>
            <th>Active</th>
            <th>Revenue</th>
            <th>Revenue Share</th>
            <th>Avg Rate/Night</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {channels.map(ch => {
            const cs = channelStyle(ch.channel_type);
            const share = parseFloat(ch.revenue_share_pct) || 0;
            return (
              <tr key={ch.booking_channel_id} className="pay-hist-row">
                <td>
                  <div className="chan-name">{ch.channel_name}</div>
                  <div className="pay-hist-meta">{ch.channel_code}</div>
                </td>
                <td>
                  <span className="pay-hist-type-badge" style={{ background: cs.bg, color: cs.color }}>
                    {ch.channel_type}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{ch.commission_percent}%</td>
                <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{ch.total_reservations ?? 0}</td>
                <td style={{ color: 'var(--pay-full)', fontWeight: 600 }}>{ch.active_reservations ?? 0}</td>
                <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(ch.total_revenue)}</td>
                <td>
                  <div className="chan-share-wrap">
                    <div className="chan-share-bar" style={{ width: Math.min(share, 100) + '%' }} />
                    <span className="chan-share-label">{share.toFixed(1)}%</span>
                  </div>
                </td>
                <td>{fmtCurrency(ch.avg_nightly_rate)}</td>
                <td>
                  <span className="pay-hist-status" style={{
                    background: ch.status === 'ACTIVE' ? 'var(--channel-active-bg)' : 'var(--channel-inactive-bg)',
                    color: ch.status === 'ACTIVE' ? 'var(--channel-active-color)' : 'var(--channel-inactive-color)',
                  }}>
                    {ch.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

//  Main 
export default function AdminLocationChannels() {
  const { setFlash } = useFlash();
  const [activeView, setActiveView] = useState('channels'); // 'channels' | 'locations'

  const [channels,   setChannels]   = useState([]);
  const [totalRev,   setTotalRev]   = useState(0);
  const [locationTree, setLocationTree] = useState([]);
  const [loading,    setLoading]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (activeView === 'channels') {
        const res = await apiRequest('/admin/channels');
        setChannels(res.data || []);
        setTotalRev(res.total_revenue || 0);
      } else {
        const res = await apiRequest('/admin/location-tree');
        setLocationTree(res.data || []);
      }
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeView, setFlash]);

  useEffect(() => {
    load();
  }, [load]);

  // Channel KPI summary
  const totalResv  = channels.reduce((s, c) => s + (c.total_reservations || 0), 0);
  const activeResv = channels.reduce((s, c) => s + (c.active_reservations || 0), 0);
  const topChannel = channels[0];

  return (
    <section className="page-card page-card-wide" id="admin-loc-channels">
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Data Explorer</p>
          <h2 className="page-title">Distribution &amp; Geography</h2>
          <p className="page-sub">Booking channel performance and hotel location hierarchy.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={activeView === 'channels' ? 'primary-button' : 'ghost-button'}
            onClick={() => setActiveView('channels')}
          > Booking Channels</button>
          <button
            className={activeView === 'locations' ? 'primary-button' : 'ghost-button'}
            onClick={() => setActiveView('locations')}
          > Location Tree</button>
        </div>
      </div>

      {loading && <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>Loading...</p>}

      {/*  Booking Channels view  */}
      {!loading && activeView === 'channels' && (
        <>
          {/* KPI cards */}
          <div className="pay-hist-kpis" style={{ marginBottom: 24 }}>
            <div className="pay-hist-kpi pay-hist-kpi--main">
              <span className="pay-hist-kpi-label">Total Revenue</span>
              <span className="pay-hist-kpi-value">{fmtCurrency(totalRev)}</span>
            </div>
            <div className="pay-hist-kpi">
              <span className="pay-hist-kpi-label">Channels Active</span>
              <span className="pay-hist-kpi-value">{channels.filter(c => c.status === 'ACTIVE').length}</span>
            </div>
            <div className="pay-hist-kpi">
              <span className="pay-hist-kpi-label">Total Reservations</span>
              <span className="pay-hist-kpi-value">{totalResv}</span>
            </div>
            <div className="pay-hist-kpi">
              <span className="pay-hist-kpi-label">Active Reservations</span>
              <span className="pay-hist-kpi-value">{activeResv}</span>
            </div>
            {topChannel && (
              <div className="pay-hist-kpi">
                <span className="pay-hist-kpi-label">Top Channel</span>
                <span className="pay-hist-kpi-value" style={{ fontSize: '1rem' }}>{topChannel.channel_name}</span>
              </div>
            )}
          </div>

          {channels.length === 0
            ? <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>No channel data found.</p>
            : <ChannelTable channels={channels} />}
        </>
      )}

      {/*  Location Tree view  */}
      {!loading && activeView === 'locations' && (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>
              Recursive CTE  {locationTree.reduce(function count(s, n) {
                return s + 1 + (n.children || []).reduce(count, 0);
              }, 0)} locations
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--admin-info)' }}>Click rows to expand/collapse</span>
          </div>

          <div className="loc-tree-wrap">
            {locationTree.length === 0
              ? <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>No location data found.</p>
              : locationTree.map(node => <TreeNode key={node.location_id} node={node} depth={0} />)
            }
          </div>
        </>
      )}
    </section>
  );
}
