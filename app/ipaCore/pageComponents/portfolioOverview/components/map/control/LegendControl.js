export class LegendControl {
    constructor({ onReady, className = "legend-ctrl" } = {}) {
        this._onReady = onReady;
        this._el = null;
    }
    onAdd(map) {
        const container = document.createElement("div");
        container.className = `mapboxgl-ctrl ${this._className || "legend-ctrl"}`;

        const portalEl = document.createElement("div");
        portalEl.className = "legend-ctrl-portal";
        container.appendChild(portalEl);

        this._el = container;
        this._onReady?.(portalEl);
        return container;
    }
    onRemove() {
        this._onReady?.(null);
        this._el?.remove();
        this._el = null;
    }
    getDefaultPosition() {
        return "bottom-left";
    }
}
