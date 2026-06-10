// Static photo per sample journey, fetched once by scripts/fetch-pexels.mjs.
// Codes match backend JOURNEY_META. Unmapped codes fall back to the journey's
// emoji icon wherever this map is used.
export const JOURNEY_IMAGES: Record<string, string> = {
  'HW-1001': '/img/journey-heart.jpg',
  'HW-1002': '/img/journey-knee.jpg',
  'HW-1003': '/img/journey-diabetes.jpg',
  'HW-1004': '/img/journey-copd.jpg',
}
