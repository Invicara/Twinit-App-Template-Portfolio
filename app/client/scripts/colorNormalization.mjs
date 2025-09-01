// Decide which props are color props
export function isColorProp(prop) {
    return prop === 'color' || prop.endsWith('-color');
}

// Convert many possible inputs → strict [r,g,b] (0–255)
export function normalizeColorRGB(value) {
    if (Array.isArray(value)) {
        // [r,g,b] or [r,g,b,a] or floats 0–1
        if (value.length >= 3) {
            let [r, g, b] = value;
            // if floats 0–1, scale up
            if (r <= 1 && g <= 1 && b <= 1 && (r % 1 || g % 1 || b % 1)) {
                r = Math.round(r * 255);
                g = Math.round(g * 255);
                b = Math.round(b * 255);
            }
            return [clamp255(r), clamp255(g), clamp255(b)];
        }
    } else if (typeof value === 'string') {
        const s = value.trim().toLowerCase();

        // #rgb, #rrggbb, #rgba, #rrggbbaa
        if (s[0] === '#') {
            const hex = s.slice(1);
            if (hex.length === 3 || hex.length === 4) {
                const r = parseInt(hex[0] + hex[0], 16);
                const g = parseInt(hex[1] + hex[1], 16);
                const b = parseInt(hex[2] + hex[2], 16);
                return [r, g, b];
            }
            if (hex.length === 6 || hex.length === 8) {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                return [r, g, b];
            }
        }

        // rgb()/rgba()
        const m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
        if (m) {
            let [ , r, g, b ] = m;
            r = Number(r); g = Number(g); b = Number(b);
            // Allow 0–1 floats or 0–255 ints
            if (r <= 1 && g <= 1 && b <= 1 && (r % 1 || g % 1 || b % 1)) {
                r = Math.round(r * 255);
                g = Math.round(g * 255);
                b = Math.round(b * 255);
            }
            return [clamp255(r), clamp255(g), clamp255(b)];
        }

        // Basic named colors (add more if you need)
        const NAMED = {
            black: [0,0,0], white: [255,255,255], red: [255,0,0], green: [0,128,0],
            blue: [0,0,255], cyan: [0,255,255], magenta: [255,0,255], yellow: [255,255,0],
            gray: [128,128,128], grey: [128,128,128]
        };
        if (s in NAMED) return NAMED[s];
    }

    // Last resort: default black
    return [0, 0, 0];
}

export function clamp255(n) { n = Math.round(Number(n) || 0); return Math.max(0, Math.min(255, n)); }
