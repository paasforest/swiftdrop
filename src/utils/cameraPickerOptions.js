import * as ImagePicker from 'expo-image-picker';

/**
 * Shared camera options to reduce image size / memory — helps avoid Expo Go
 * reloading when the OS kills the JS process after the native camera closes.
 */
export const launchCameraImageOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: false,
  /** Lower quality = smaller bitmap = less chance of OOM / process death in Expo Go. */
  quality: 0.45,
  exif: false,
};
