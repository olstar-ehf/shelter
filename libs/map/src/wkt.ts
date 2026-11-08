/** 1e-7 degrees is about 1.1 cm at Iceland's latitude. */
const DECIMALS = 7;

/**
 * Formats a line as WKT in the same order the coordinate textarea expects
 * (lon lat pairs), so the live draft can be pasted straight back into the
 * textarea. Points are WGS84 LatLng-like objects.
 */
export function formatWktLine(
  points: Array<{ lat: number; lng: number }>,
): string {
  const coords = points
    .map((point) => `${point.lng.toFixed(DECIMALS)} ${point.lat.toFixed(DECIMALS)}`)
    .join(', ');
  return `LINESTRING (${coords})`;
}
