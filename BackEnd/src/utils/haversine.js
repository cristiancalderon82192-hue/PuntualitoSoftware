/**
 * Calcula la distancia en metros entre dos coordenadas geográficas
 * usando la fórmula de Haversine.
 * 
 * @param {number} lat1 Latitud del punto 1 (Sede)
 * @param {number} lon1 Longitud del punto 1 (Sede)
 * @param {number} lat2 Latitud del punto 2 (Empleado)
 * @param {number} lon2 Longitud del punto 2 (Empleado)
 * @returns {number} Distancia en metros
 */
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = lat1 * (Math.PI / 180); // φ, λ en radianes
  const φ2 = lat2 * (Math.PI / 180);
  const Δφ = (lat2 - lat1) * (Math.PI / 180);
  const Δλ = (lon2 - lon1) * (Math.PI / 180);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanciaMetros = R * c; 
  return distanciaMetros;
}

module.exports = {
  calcularDistancia
};
