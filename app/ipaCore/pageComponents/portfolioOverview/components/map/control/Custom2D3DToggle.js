// Custom2D3DToggle.js
export class Custom2D3DToggle {
    constructor(opts) {
        const defaults = { pitch: 60, bearing: -60, minpitchzoom: undefined, position: 'bottom-right' };
        this._options = Object.assign({}, defaults, opts || {});
        this._map = null;
        this._container = null; // placeholder container for Mapbox's control management
        this._btn = null;       // the actual button we inject into the existing group
    }

    onAdd(map) {
        this._map = map;

        // 1) Create a tiny placeholder that Mapbox will add/remove for us
        const container = document.createElement('div');
        container.className = 'mapboxgl-ctrl'; // minimal footprint
        this._container = container;

        // 2) Create the actual button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapboxgl-ctrl-icon';
        const is3D = this._map.getPitch() > 0;
        btn.textContent = is3D ? '2D' : '3D'
        btn.setAttribute('aria-label', 'Toggle 3D');
        btn.title = 'Toggle 3D';

        btn.addEventListener('click', () => {
            const is3D = this._map.getPitch() > 0;
            const { pitch, bearing, minpitchzoom } = this._options;

            if (!is3D && typeof minpitchzoom === 'number' && this._map.getZoom() < minpitchzoom) {
                this._map.easeTo({ zoom: minpitchzoom });
            }

            this._map.easeTo({
                pitch: is3D ? 0 : pitch,
                bearing: is3D ? 0 : bearing
            });

            this._updateIcon();
        });

        // 3) Find (or create) the target group in the specified corner and append the button there
        const cornerSelector = `.mapboxgl-ctrl-${this._options.position}`;
        const corner = map.getContainer().querySelector(cornerSelector);

        // Prefer an existing group (e.g., from NavigationControl)
        let group = corner && corner.querySelector('.mapboxgl-ctrl-group');

        // If no group exists yet at that corner, create one (so we still look native)
        if (!group && corner) {
            group = document.createElement('div');
            group.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
            corner.appendChild(group);
        }

        if (group) {
            group.appendChild(btn);
            this._btn = btn;
            this._updateIcon();
        } else {
            // Fallback: if somehow no corner found, just put the button in our own container
            this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
            this._container.appendChild(btn);
            this._btn = btn;
            this._updateIcon();
        }

        return container; // Mapbox will add/remove this (not the shared group)
    }

    onRemove() {
        // Remove only our button; leave the shared group intact
        if (this._btn && this._btn.parentNode) {
            this._btn.parentNode.removeChild(this._btn);
        }
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._map = null;
        this._container = null;
        this._btn = null;
    }

    _updateIcon() {
        if (!this._btn || !this._map) return;
        const is3D = this._map.getPitch() > 0;
        this._btn.textContent = is3D ? '2D' : '3D'
        this._btn.classList.toggle('is-3d', !!is3D);
        this._btn.title = is3D ? 'Switch to 2D' : 'Switch to 3D';
        this._btn.setAttribute('aria-pressed', String(!!is3D));
    }
}
