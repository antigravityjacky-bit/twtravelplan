/**
 * Geocode a street address to {lat, lng} using the free Nominatim API.
 * Returns null if the address cannot be resolved.
 */
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
