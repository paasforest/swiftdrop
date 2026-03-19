const cloudinary = require('cloudinary').v2;

/**
 * Upload a Multer memory file to Cloudinary.
 * Requires CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + keys in env.
 */
function uploadImage(file) {
  if (!file?.buffer) {
    return Promise.reject(new Error('No file buffer'));
  }

  const configured =
    Boolean(process.env.CLOUDINARY_URL) ||
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET);

  if (!configured) {
    return Promise.reject(new Error('Cloudinary is not configured (set CLOUDINARY_URL or CLOUDINARY_* vars)'));
  }

  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'swiftdrop', resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        if (!result?.secure_url) return reject(new Error('Cloudinary upload returned no URL'));
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

module.exports = { uploadImage };
