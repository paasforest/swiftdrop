/**
 * Google Maps / Places REST (autocomplete/details).
 * Uses EXPO_PUBLIC_* for local overrides; falls back to app.json extra.googleMapsApiKey
 * so standalone/EAS builds work without a checked-in .env.
 */
import Constants from 'expo-constants';

const extraKey =
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  Constants.manifest?.extra?.googleMapsApiKey ||
  '';

export const GOOGLE_MAPS_API_KEY =
  String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim() ||
  String(extraKey || '').trim();
