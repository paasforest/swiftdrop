/**
 * Google Maps / Places (JS fetch). Prefer EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env;
 * falls back to the same key as app.json ios.config.googleMapsApiKey / android.config.googleMaps.apiKey for dev.
 */
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  'AIzaSyCT28_D6Bc-cGPnpuHs85gWSvAu-XelE7Y';
