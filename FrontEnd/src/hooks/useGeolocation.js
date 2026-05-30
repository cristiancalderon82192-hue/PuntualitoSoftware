import { useState, useCallback } from 'react';

export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('La geolocalización no está soportada por tu navegador');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        });
        setLoading(false);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError('Denegaste el permiso para obtener tu ubicación.');
            break;
          case error.POSITION_UNAVAILABLE:
            setError('La información de tu ubicación no está disponible. Asegúrate de tener el GPS encendido.');
            break;
          case error.TIMEOUT:
            setError('Se agotó el tiempo de espera para obtener tu ubicación.');
            break;
          default:
            setError('Ocurrió un error desconocido al obtener la ubicación.');
            break;
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  return { location, error, loading, getLocation, setLocation, setError };
};
