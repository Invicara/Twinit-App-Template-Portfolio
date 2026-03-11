/**
 * Resolve map-pin cursor value for the current origin and base path,
 * so the cursor works on any deployment (root, subpath, different domain).
 * Fallback: crosshair if the image fails to load.
 */
export function getMapPinCursorValue() {
    if (typeof window === 'undefined') return 'crosshair';
    const base = (typeof process !== 'undefined' && process.env?.PUBLIC_URL) || (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
    // Normalize: strip trailing slash, treat "." as root
    const basePath = String(base).replace(/\/$/, '').replace(/^\.$/, '');
    const url = window.location.origin + basePath + '/icons/map-pin.svg';
    return `url("${url}") 12 24, crosshair`;
}
