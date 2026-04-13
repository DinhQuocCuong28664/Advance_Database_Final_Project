import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAppData } from '../context/AppDataContext';
import { useFlash } from '../context/FlashContext';
import { nextDate } from '../utils/formatters';

export function useAdmin() {
  const { hotels } = useAppData();
  const { setFlash } = useFlash();

  const [adminTab, setAdminTab] = useState('desk');
  const [opsSearch, setOpsSearch] = useState({ hotelId: '', checkin: nextDate(0), checkout: nextDate(2) });
  const [opsBusy, setOpsBusy] = useState(false);
  const [opsRecordBusy, setOpsRecordBusy] = useState(null);
  const [opsRooms, setOpsRooms] = useState([]);
  const [feedsBusy, setFeedsBusy] = useState(false);
  const [housekeeping, setHousekeeping] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [revenue, setRevenue] = useState([]);

  // Set default hotel when hotels load
  useEffect(() => {
    if (!hotels.length) return;
    const firstHotelId = String(hotels[0].hotel_id);
    setOpsSearch((current) => (current.hotelId ? current : { ...current, hotelId: firstHotelId }));
  }, [hotels]);

  async function handleOpsSearch(event) {
    event?.preventDefault();
    setOpsBusy(true);
    try {
      const query = new URLSearchParams({
        hotel_id: opsSearch.hotelId,
        checkin: opsSearch.checkin,
        checkout: opsSearch.checkout,
      });
      const payload = await apiRequest(`/rooms/availability?${query.toString()}`);
      setOpsRooms(payload.data || []);
      setFlash({ tone: 'success', text: 'Inventory grid refreshed.' });
    } catch (error) {
      setOpsRooms([]);
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setOpsBusy(false);
    }
  }

  async function handleOpsFeeds() {
    setFeedsBusy(true);
    try {
      const hotelId = opsSearch.hotelId;
      const [housekeepingPayload, maintenancePayload, revenuePayload] = await Promise.all([
        apiRequest(`/housekeeping?hotel_id=${hotelId}`),
        apiRequest(`/maintenance?hotel_id=${hotelId}`),
        apiRequest('/admin/reports/revenue'),
      ]);
      setHousekeeping(housekeepingPayload.data || []);
      setMaintenance(maintenancePayload.data || []);
      setRevenue(revenuePayload.data || []);
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setFeedsBusy(false);
    }
  }

  async function updateAvailability(record, availabilityStatus) {
    setOpsRecordBusy(record.availability_id);
    try {
      await apiRequest(`/admin/availability/${record.availability_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          availability_status: availabilityStatus,
          expected_version: record.version_no,
          inventory_note: `Updated from frontend to ${availabilityStatus}`,
        }),
      });
      setFlash({ tone: 'success', text: `availability_id ${record.availability_id} -> ${availabilityStatus}` });
      await handleOpsSearch();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setOpsRecordBusy(null);
    }
  }

  return {
    adminTab, setAdminTab,
    opsSearch, setOpsSearch,
    opsBusy,
    opsRecordBusy,
    opsRooms,
    feedsBusy,
    housekeeping,
    maintenance,
    revenue,
    handleOpsSearch,
    handleOpsFeeds,
    updateAvailability,
  };
}
