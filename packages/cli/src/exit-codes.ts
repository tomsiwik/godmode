export const EXIT_CODES = {
  success: 0,
  usage: 2,
  notFound: 3,
  permissionDenied: 4,
  upstream4xx: 10,
  upstream5xx: 11,
  upstream: 12,
} as const;

