import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFlash } from '../../context/FlashContext';

function formatCurrency(value, currency = 'VND') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}

export default function AdminReports({ reportSummary, revenueData, brandRevenueData = [], loading }) {
  const { setFlash } = useFlash();

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    if (reportSummary) {
      const kpiRows = [
        ['Metric', 'Value'],
        ['Total Reservations', reportSummary.overview?.total_reservations ?? '-'],
        ['Active Reservations', reportSummary.overview?.active_reservations ?? '-'],
        ['Hotels With Bookings', reportSummary.overview?.hotels_with_bookings ?? '-'],
        [],
        ['Status', 'Count'],
        ...(reportSummary.by_status || []).map((r) => [r.reservation_status, r.count]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiRows), 'Summary');

      const hotelRows = [
        ['Hotel', 'Bookings', 'Total Revenue (VND)'],
        ...(reportSummary.top_hotels || []).map((r) => [r.hotel_name, r.bookings, Number(r.total_revenue)]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hotelRows), 'Top Hotels');

      const payRows = [
        ['Payment Method', 'Count', 'Total Amount (VND)'],
        ...(reportSummary.payment_stats || []).map((r) => [r.payment_method, r.count, Number(r.total_amount)]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payRows), 'Payments');
    }

    if (revenueData.length) {
      const revRows = [
        ['Hotel', 'Room Type', 'Year', 'Quarter', 'Bookings', 'Revenue (VND)', 'Avg Nightly Rate', 'Revenue Share %'],
        ...revenueData.map((r) => [
          r.hotel_name, r.room_type_name, r.year, r.quarter,
          r.booking_count, Number(r.total_revenue), Number(r.avg_nightly_rate),
          Number(r.revenue_share_pct).toFixed(2) + '%',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(revRows), 'Revenue Detail');
    }


    if (brandRevenueData.length) {
      const brandRows = [
        ['Chain', 'Brand', 'Hotel', 'Year', 'Q', 'Bookings', 'Revenue', 'Avg Rate/Night', 'Rank in Brand', 'Cumul. Brand Rev.', 'Chain Share %', 'Brand Share %'],
        ...brandRevenueData.map((r) => [
          r.chain_name, r.brand_name, r.hotel_name, r.year, r.quarter,
          r.booking_count, Number(r.total_revenue), Number(r.avg_nightly_rate),
          r.revenue_rank_in_brand, Number(r.cumulative_brand_revenue),
          Number(r.revenue_share_in_chain_pct).toFixed(2) + '%',
          Number(r.revenue_share_in_brand_pct).toFixed(2) + '%',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(brandRows), 'Revenue by Brand');
    }

    XLSX.writeFile(wb, `LuxeReserve_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setFlash({ tone: 'success', text: 'Excel report downloaded.' });
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleDateString('en-GB');

    doc.setFontSize(16);
    doc.text('LuxeReserve  Analytics Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${now}`, 14, 22);

    let y = 30;

    if (reportSummary?.overview) {
      doc.setFontSize(12);
      doc.text('Summary KPIs', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Metric', 'Value']],
        body: [
          ['Total Reservations', reportSummary.overview.total_reservations],
          ['Active Reservations', reportSummary.overview.active_reservations],
          ['Hotels With Bookings', reportSummary.overview.hotels_with_bookings],
        ],
        theme: 'grid',
        styles: { fontSize: 9 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    if (reportSummary?.top_hotels?.length) {
      doc.setFontSize(12);
      doc.text('Top Hotels by Revenue', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Hotel', 'Bookings', 'Total Revenue (VND)']],
        body: reportSummary.top_hotels.map((r) => [r.hotel_name, r.bookings, formatCurrency(r.total_revenue)]),
        theme: 'striped',
        styles: { fontSize: 9 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    if (revenueData.length) {
      if (y > 150) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.text('Revenue by Hotel & Room Type (Window Functions)', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Hotel', 'Room Type', 'Year', 'Q', 'Bookings', 'Revenue (VND)', 'Share %']],
        body: revenueData.map((r) => [
          r.hotel_name, r.room_type_name, r.year, r.quarter,
          r.booking_count, formatCurrency(r.total_revenue),
          Number(r.revenue_share_pct).toFixed(1) + '%',
        ]),
        theme: 'striped',
        styles: { fontSize: 8 },
      });
    }

    doc.save(`LuxeReserve_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    setFlash({ tone: 'success', text: 'PDF report downloaded.' });
  }

  return (
    <section className="page-card page-card-wide" id="admin-reports">
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Analytics</p>
          <h2>Reports &amp; Statistics</h2>
        </div>
        <div className="report-export-btns">
          <button className="ghost-button" type="button" onClick={exportExcel} disabled={loading}>
             Export Excel
          </button>
          <button className="primary-button" type="button" onClick={exportPDF} disabled={loading}>
             Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <p className="admin-empty">Loading report data...</p>
      ) : reportSummary ? (
        <>
          {/* KPI strip */}
          <div className="report-kpi-grid">
            <article className="report-kpi-card">
              <span>Total Reservations</span>
              <strong>{reportSummary.overview?.total_reservations ?? ''}</strong>
            </article>
            <article className="report-kpi-card">
              <span>Active Reservations</span>
              <strong>{reportSummary.overview?.active_reservations ?? ''}</strong>
            </article>
            <article className="report-kpi-card">
              <span>Hotels With Bookings</span>
              <strong>{reportSummary.overview?.hotels_with_bookings ?? ''}</strong>
            </article>
            <article className="report-kpi-card">
              <span>Payment Methods Tracked</span>
              <strong>{reportSummary.payment_stats?.length ?? ''}</strong>
            </article>
          </div>

          <div className="report-two-col">
            {/* Reservations by status */}
            <div>
              <h3 className="report-table-title">Reservations by Status</h3>
              <table className="report-table">
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  {(reportSummary.by_status || []).map((row) => (
                    <tr key={row.reservation_status}>
                      <td><span className={`rsv-badge rsv-${row.reservation_status?.toLowerCase()}`}>{row.reservation_status}</span></td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top hotels */}
            <div>
              <h3 className="report-table-title">Top Hotels by Revenue</h3>
              <table className="report-table">
                <thead><tr><th>Hotel</th><th>Bookings</th><th>Revenue</th></tr></thead>
                <tbody>
                  {(reportSummary.top_hotels || []).map((row, i) => (
                    <tr key={i}>
                      <td>{row.hotel_name}</td>
                      <td>{row.bookings}</td>
                      <td>{formatCurrency(row.total_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment breakdown */}
          {reportSummary.payment_stats?.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 className="report-table-title">Payment Breakdown</h3>
              <table className="report-table">
                <thead><tr><th>Method</th><th>Transactions</th><th>Total Amount</th></tr></thead>
                <tbody>
                  {reportSummary.payment_stats.map((row, i) => (
                    <tr key={i}>
                      <td>{row.payment_method}</td>
                      <td>{row.count}</td>
                      <td>{formatCurrency(row.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Revenue detail (Window Functions) */}
          {revenueData.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 className="report-table-title">Revenue by Hotel &amp; Room Type <span className="report-tag">Window Functions</span></h3>
              <div className="report-table-scroll">
                <table className="report-table report-table--brand">
                  <thead>
                    <tr>
                      <th>Hotel</th><th>Room Type</th><th>Year</th><th>Q</th>
                      <th>Bookings</th><th>Revenue</th><th>Avg Rate/Night</th><th>Revenue Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.map((row, i) => (
                      <tr key={i}>
                        <td>{row.hotel_name}</td>
                        <td>{row.room_type_name}</td>
                        <td>{row.year}</td>
                        <td>Q{row.quarter}</td>
                        <td>{row.booking_count}</td>
                        <td>{formatCurrency(row.total_revenue)}</td>
                        <td>{formatCurrency(row.avg_nightly_rate)}</td>
                        <td>{Number(row.revenue_share_pct).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* Revenue by Brand (Chain  Brand  Hotel hierarchy + Window Functions) */}
          {brandRevenueData.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 className="report-table-title">
                Revenue by Brand &amp; Chain
                <span className="report-tag">Window Functions</span>
                <span className="report-tag report-tag--blue">Hierarchy</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: 10 }}>
                HotelChain  Brand  Hotel  DENSE_RANK, cumulative revenue &amp; share % within brand and chain
              </p>
              <div className="report-table-scroll">
                <table className="report-table report-table--brand">
                  <thead>
                    <tr>
                      <th>Chain</th>
                      <th>Brand</th>
                      <th>Hotel</th>
                      <th>Year</th>
                      <th>Q</th>
                      <th>Bookings</th>
                      <th>Revenue</th>
                      <th>Avg Rate/Night</th>
                      <th title="DENSE_RANK within Brand">Rank in Brand</th>
                      <th title="Cumulative revenue within Brand over time">Cumul. Brand Rev.</th>
                      <th className="brand-share-col" title="Revenue share % within entire Chain">Chain Share %</th>
                      <th className="brand-share-col" title="Revenue share % within Brand">Brand Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandRevenueData.map((row, i) => (
                      <tr key={i}>
                        <td><strong>{row.chain_name}</strong></td>
                        <td>{row.brand_name}</td>
                        <td>{row.hotel_name}</td>
                        <td>{row.year}</td>
                        <td>Q{row.quarter}</td>
                        <td>{row.booking_count}</td>
                        <td>{formatCurrency(row.total_revenue)}</td>
                        <td>{formatCurrency(row.avg_nightly_rate)}</td>
                        <td>
                          <span className={`brand-rank-badge brand-rank-badge--${row.revenue_rank_in_brand <= 3 ? row.revenue_rank_in_brand : 'other'}`}>
                            #{row.revenue_rank_in_brand}
                          </span>
                        </td>
                        <td>{formatCurrency(row.cumulative_brand_revenue)}</td>
                        <td className="brand-share-col">
                          <span className="brand-share-cell" title={`${Number(row.revenue_share_in_chain_pct).toFixed(1)}% of chain`}>
                            <span className="brand-share-track">
                              <span className="brand-share-bar" style={{ width: Math.min(Number(row.revenue_share_in_chain_pct), 100) + '%' }} />
                            </span>
                            <span className="brand-share-label">{Number(row.revenue_share_in_chain_pct).toFixed(1)}%</span>
                          </span>
                        </td>
                        <td className="brand-share-col">
                          <span className="brand-share-plain">{Number(row.revenue_share_in_brand_pct).toFixed(1)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </>
      ) : (
        <p className="admin-empty">No report data available.</p>
      )}
    </section>
  );
}
