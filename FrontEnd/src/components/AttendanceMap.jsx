import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const sedeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapBounds({ userLat, userLng, sedeLat, sedeLng }) {
  const map = useMap();
  useEffect(() => {
    if (userLat && userLng && sedeLat && sedeLng) {
      const bounds = L.latLngBounds([
        [parseFloat(userLat), parseFloat(userLng)],
        [parseFloat(sedeLat), parseFloat(sedeLng)]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [userLat, userLng, sedeLat, sedeLng, map]);
  return null;
}

export default function AttendanceMap({ userLat, userLng, sedeLat, sedeLng, sedeRadius }) {
  if (!userLat || !userLng || !sedeLat || !sedeLng) return null;

  return (
    <div className="w-full h-[250px] rounded-2xl overflow-hidden border border-slate-200 relative z-0 mb-6 shadow-inner">
      <MapContainer 
        center={[parseFloat(userLat), parseFloat(userLng)]} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        
        {/* User Location */}
        <Marker position={[parseFloat(userLat), parseFloat(userLng)]}>
          <Popup>Tu ubicación actual (GPS)</Popup>
        </Marker>

        {/* Sede Location */}
        <Marker position={[parseFloat(sedeLat), parseFloat(sedeLng)]} icon={sedeIcon}>
          <Popup>Ubicación de tu Sede</Popup>
        </Marker>

        <MapBounds userLat={userLat} userLng={userLng} sedeLat={sedeLat} sedeLng={sedeLng} />
      </MapContainer>
    </div>
  );
}
