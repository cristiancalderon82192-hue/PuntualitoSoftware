import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
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

// Component to recenter map dynamically
function MapRecenter({ centerLat, centerLng }) {
  const map = useMap();
  useEffect(() => {
    if (centerLat !== undefined && centerLng !== undefined) {
      // Usar el nivel de zoom actual del usuario para no alejarle la vista
      map.flyTo([centerLat, centerLng], map.getZoom(), { duration: 0.5 });
    }
  }, [centerLat, centerLng, map]);
  return null;
}

export default function MapSelector({ lat, lng, radius, onChange }) {
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      // Solicitar ubicación del administrador en tiempo real
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error obteniendo ubicación del admin:", error);
        },
        { enableHighAccuracy: true } // Alta precisión para facilitar geocercas
      );
    }
  }, []);

  const defaultCenter = [4.6097, -74.0817]; // Bogotá como fallback principal

  const hasSelectedLocation = lat && lng;
  const currentCenter = hasSelectedLocation 
    ? [parseFloat(lat), parseFloat(lng)] 
    : (userLocation || defaultCenter);

  const mapRadius = radius ? parseInt(radius, 10) : 0;

  return (
    <div className="w-full h-[300px] rounded-lg overflow-hidden border border-slate-300 relative z-0">
      <MapContainer 
        center={currentCenter} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <LocationSelector onChange={onChange} />
        
        {/* Mostramos la ubicación actual del administrador si está disponible */}
        {userLocation && (
          <CircleMarker 
            center={userLocation} 
            radius={7}
            pathOptions={{ color: 'white', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
              Tú estás aquí
            </Tooltip>
          </CircleMarker>
        )}

        {hasSelectedLocation && (
          <>
            <Marker position={[parseFloat(lat), parseFloat(lng)]} />
            {mapRadius > 0 && (
               <Circle 
                 center={[parseFloat(lat), parseFloat(lng)]} 
                 radius={mapRadius}
                 pathOptions={{ color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.2 }}
               />
            )}
          </>
        )}
        
        <MapRecenter centerLat={currentCenter[0]} centerLng={currentCenter[1]} />
      </MapContainer>
      
      {!hasSelectedLocation && !userLocation && (
        <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center pointer-events-none z-[400]">
          <span className="bg-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-slate-700">
            Obteniendo tu ubicación... o haz clic para ubicar la Sede
          </span>
        </div>
      )}
      {!hasSelectedLocation && userLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
          <span className="bg-white px-4 py-2 text-center rounded-lg shadow-sm text-sm font-medium text-slate-700">
            Acomoda el mapa y haz clic para fijar la Sede
          </span>
        </div>
      )}
    </div>
  );
}
