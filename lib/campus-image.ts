export const CAMPUS_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const CAMPUS_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Shared by the file picker and Convex; the browser's accept attribute is only a hint.
export function campusImageError(file: { contentType?: string; size: number }) {
  if (!file.contentType || !CAMPUS_IMAGE_TYPES.includes(file.contentType))
    return "type";
  if (file.size === 0 || file.size > CAMPUS_IMAGE_MAX_BYTES) return "size";
  return null;
}
