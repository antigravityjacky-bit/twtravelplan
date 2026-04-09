/**
 * Geocode a street address to {lat, lng} using the free Nominatim API.
 * Returns null if the address cannot be resolved.
 */

/**
 * Search for up to `limit` matching places.
 * Returns an array of { lat, lng, label } objects (empty array on failure).
 */
export async function searchPlaces(query, limit = 5) {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?' +
      new URLSearchParams({
        q: query,
        format: 'json',
        limit: String(limit),
        countrycodes: 'tw',
      });

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'zh-TW,zh,en',
        'User-Agent': 'TaiwanTripPlanner/1.0',
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      label: item.display_name,
    }));
  } catch {
    return [];
  }
}

export async function geocodeAddress(address) {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?' +
      new URLSearchParams({
        q: address,
        format: 'json',
        limit: '1',
        countrycodes: 'tw', // bias towards Taiwan
      });

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'zh-TW,zh,en',
        'User-Agent': 'TaiwanTripPlanner/1.0',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}
