import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function createPin(label, modifier) {
  return L.divIcon({
    className: 'search-map-pin-wrap',
    html: `<span class="search-map-pin search-map-pin--${modifier}">${label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function fitBoundsForPoints(map, points) {
  if (points.length >= 2) {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.24), { animate: false });
    return;
  }

  if (points.length === 1) {
    map.setView(points[0], 13, { animate: false });
  }
}

function MapViewport({ points }) {
  const map = useMap();

  useEffect(() => {
    fitBoundsForPoints(map, points);
  }, [map, points]);

  return null;
}

function haversineKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const calc = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(calc));
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(distanceKm >= 10 ? 0 : 1)} km`;
}

export default function SearchDirectionsPreview({
  hotel,
  userLocation,
  status,
  isLocating,
  onOpenGoogleMaps,
  onRefreshLocation,
}) {
  const hotelPoint = useMemo(
    () => [Number(hotel.latitude), Number(hotel.longitude)],
    [hotel.latitude, hotel.longitude],
  );
  const userPoint = useMemo(
    () => (userLocation ? [userLocation.latitude, userLocation.longitude] : null),
    [userLocation],
  );
  const mapPoints = useMemo(
    () => (userPoint ? [hotelPoint, userPoint] : [hotelPoint]),
    [hotelPoint, userPoint],
  );
  const directDistance = useMemo(
    () => (userPoint ? haversineKm(userPoint, hotelPoint) : null),
    [hotelPoint, userPoint],
  );
  const hotelIcon = useMemo(() => createPin('H', 'hotel'), []);
  const userIcon = useMemo(() => createPin('You', 'user'), []);

  return (
    <section className="search-directions-panel">
      <div className="search-directions-panel__body">
        <div className="search-directions-panel__copy">
          <p className="page-eyebrow">Route Preview</p>
          <h2 className="search-directions-panel__title">{hotel.hotel_name}</h2>
          <p className="search-directions-panel__subtitle">
            Preview the hotel location in-app, then open Google Maps for turn-by-turn driving directions.
          </p>
          <div className="search-directions-panel__meta">
            <span>{hotel.brand_name || hotel.chain_name || 'LuxeReserve'}</span>
            {directDistance ? <span>Approx. {formatDistance(directDistance)} away in a straight line</span> : null}
            {userLocation?.accuracy ? <span>Location accuracy {Math.round(userLocation.accuracy)} m</span> : null}
          </div>
          <div className="search-directions-panel__actions">
            <button className="primary-button" type="button" onClick={onOpenGoogleMaps}>
              Open in Google Maps
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={onRefreshLocation}
              disabled={isLocating}
            >
              {isLocating ? 'Refreshing...' : 'Refresh location'}
            </button>
          </div>
          <p className={`search-directions-panel__status search-route-note--${status?.tone || 'info'}`}>
            {status?.message
              || (userPoint
                ? 'Your current location is included in this preview.'
                : 'Hotel location preview is ready. Allow location access to include your current position.')}
          </p>
        </div>

        <div className="search-directions-map-wrap">
          <MapContainer
            center={hotelPoint}
            zoom={13}
            scrollWheelZoom={false}
            className="search-directions-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewport points={mapPoints} />
            <Marker position={hotelPoint} icon={hotelIcon}>
              <Popup>{hotel.hotel_name}</Popup>
            </Marker>
            {userPoint ? (
              <Marker position={userPoint} icon={userIcon}>
                <Popup>Your current location</Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </div>
      </div>
    </section>
  );
}
