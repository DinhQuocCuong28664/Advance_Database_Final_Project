import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

const AppDataContext = createContext();

export function AppDataProvider({ children }) {
  const [apiInfo, setApiInfo] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [guests, setGuests] = useState([]);
  const [publicPromotions, setPublicPromotions] = useState([]);
  const [bootError, setBootError] = useState('');
  const [hotelDetails, setHotelDetails] = useState({});

  // Boot — load core reference data on mount
  useEffect(() => {
    async function boot() {
      setBootError('');
      try {
        const [apiPayload, hotelPayload, guestPayload, promotionPayload] = await Promise.all([
          apiRequest(''),
          apiRequest('/hotels'),
          apiRequest('/guests'),
          apiRequest('/promotions'),
        ]);

        setApiInfo(apiPayload);
        setHotels(hotelPayload.data || []);
        setGuests(guestPayload.data || []);
        setPublicPromotions(promotionPayload.data || []);
      } catch (error) {
        setBootError(error.message);
      }
    }

    boot();
  }, []);

  async function ensureHotelDetail(hotelId) {
    const key = String(hotelId);
    if (hotelDetails[key]) return hotelDetails[key];
    const payload = await apiRequest(`/hotels/${hotelId}`);
    setHotelDetails((current) => ({ ...current, [key]: payload.data }));
    return payload.data;
  }

  return (
    <AppDataContext.Provider value={{
      apiInfo,
      hotels,
      guests,
      publicPromotions,
      bootError,
      hotelDetails,
      ensureHotelDetail,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppDataContext);
}
