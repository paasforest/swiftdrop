/**
 * Shared Google Places helpers (same API usage as AddressEntry).
 */
import { GOOGLE_MAPS_API_KEY } from '../placesConfig';

export async function fetchPlacePredictions(input) {
  const key = GOOGLE_MAPS_API_KEY;
  if (!key || input.trim().length < 2) return [];
  const searchText = input.trim();
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
    `input=${encodeURIComponent(searchText)}&components=country:za&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status === 'ZERO_RESULTS') return [];
  if (json.status !== 'OK') {
    throw new Error(json.error_message || json.status || 'Places error');
  }
  return json.predictions || [];
}

export async function fetchPlaceDetails(placeId) {
  const key = GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('Google Maps API key not configured');
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${encodeURIComponent(placeId)}` +
    `&fields=geometry,formatted_address&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK') {
    throw new Error(json.error_message || json.status || 'Place details failed');
  }
  const loc = json.result?.geometry?.location;
  if (!loc) throw new Error('No location for place');
  return {
    latitude: loc.lat,
    longitude: loc.lng,
    formatted_address: json.result.formatted_address || '',
  };
}
