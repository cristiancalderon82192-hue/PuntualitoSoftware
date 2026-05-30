import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to handle map clicks
function LocationSelector({ onChange }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to recenter map when lat/lng change from outside (e.g., editing an existing Sede)
function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

export default function MapSelector({ lat, lng, radius, onChange }) {
  // Default to a central location if none provided (e.g., Madrid or Buenos Aires or user's city)
  // Let's use a generic default, e.g. 0,0 or a known city. Let's use 19.4326, -99.1332 (Mexico City) as a fallback
  const defaultCenter = [19.4326, -99.1332];
  
  const center = lat && lng ? [parseFloat(lat), parseFloat(lng)] : defaultCenter;
  const mapRadius = radius ? parseInt(radius, 10) : 0;

  return (
    <div className="w-full h-[300px] rounded-lg overflow-hidden border border-slate-300 relative z-0">
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <LocationSelector onChange={onChange} />
        
        {lat && lng && (
          <>
            <Marker position={[parseFloat(lat), parseFloat(lng)]} />
            {mapRadius > 0 && (
              <Circle 
                center={[parseFloat(lat), parseFloat(lng)]} 
                radius={mapRadius}
                pathOptions={{ color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.2 }}
              />
            )}
            <MapRecenter lat={parseFloat(lat)} lng={parseFloat(lng)} />
          </>
        )}
      </MapContainer>
      {!lat && !lng && (
        <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center pointer-events-none z-[400]">
          <span className="bg-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-slate-700">
            Haz clic en el mapa para ubicar la Sede
          </span>
        </div>
      )}
    </div>
  );
}
