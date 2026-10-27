/**
 * Zero-Cost Google Maps Utility for TRUCKS Logistics
 *
 * Utilizes standard public Google Maps URLs for search and directions without paid APIs
 * (zero Google Maps API costs, zero Autocomplete charges, zero Geocoding charges).
 */

export interface ParsedLocationCoordinates {
  latitude?: number;
  longitude?: number;
  label?: string;
}

/**
 * Validate whether a string is a legitimate Google Maps link or share URL
 */
export const isValidGoogleMapsUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://maps.app.goo.gl/') ||
    trimmed.startsWith('http://maps.app.goo.gl/') ||
    trimmed.startsWith('https://goo.gl/maps/') ||
    trimmed.startsWith('http://goo.gl/maps/') ||
    trimmed.includes('google.com/maps') ||
    trimmed.includes('maps.google.com')
  );
};

/**
 * Extract latitude and longitude from Google Maps URL if present in URL parameters
 */
export const extractCoordinatesFromGoogleMapsUrl = (
  url: string
): ParsedLocationCoordinates | null => {
  if (!isValidGoogleMapsUrl(url)) return null;

  try {
    // 1. Matches @latitude,longitude e.g. /@26.1445,91.7362,17z
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        latitude: parseFloat(atMatch[1]),
        longitude: parseFloat(atMatch[2]),
      };
    }

    // 2. Matches ?q=latitude,longitude or &q=latitude,longitude
    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      return {
        latitude: parseFloat(qMatch[1]),
        longitude: parseFloat(qMatch[2]),
      };
    }

    // 3. Matches destination=latitude,longitude
    const destMatch = url.match(/[?&]destination=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
    if (destMatch) {
      return {
        latitude: parseFloat(destMatch[1]),
        longitude: parseFloat(destMatch[2]),
      };
    }

    // 4. Matches ll=latitude,longitude
    const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llMatch) {
      return {
        latitude: parseFloat(llMatch[1]),
        longitude: parseFloat(llMatch[2]),
      };
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Generate directions URL for driver navigation
 * Strict format: "https://www.google.com/maps/dir/?api=1&destination=LATITUDE%2CLONGITUDE"
 * Fallback to encoded address when coordinates are not available.
 */
export const buildGoogleMapsDirectionsUrl = (options: {
  latitude?: number;
  longitude?: number;
  address?: string;
}): string => {
  if (
    options.latitude !== undefined &&
    options.longitude !== undefined &&
    !isNaN(options.latitude) &&
    !isNaN(options.longitude)
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${options.latitude}%2C${options.longitude}`;
  }

  if (options.address && options.address.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      options.address.trim()
    )}`;
  }

  return 'https://www.google.com/maps';
};

/**
 * Generate Google Maps search / view URL for a location or address
 */
export const buildGoogleMapsSearchUrl = (queryOrAddress: string): string => {
  const query = queryOrAddress?.trim() || 'Guwahati, Assam';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};
