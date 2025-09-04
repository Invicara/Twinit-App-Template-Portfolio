import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";

export default function PopupPortal({
                                        map,
                                        open,
                                        lngLat,
                                        onClose,
                                        popupOptions,
                                        children,
                                    }) {
    const containerRef = useRef(null);
    const popupRef = useRef(null);

    // 1) Create a single DOM container for React to portal into
    if (!containerRef.current) containerRef.current = document.createElement("div");

    // 2) Create the Mapbox popup once
    useMemo(() => {
        if (!popupRef.current) {
            popupRef.current = new mapboxgl.Popup({
                closeButton: true,
                closeOnClick: true,
                ...popupOptions,
            });
        }
    }, [popupOptions]);

    // 3) Wire popup lifecycle to React state
    useEffect(() => {
        const popup = popupRef.current;
        const container = containerRef.current;

        popup.setDOMContent(container);

        const handleClose = () => onClose?.();
        popup.on("close", handleClose);

        if (open && lngLat) {
            popup.setLngLat(lngLat).addTo(map);
        } else {
            popup.remove();
        }

        return () => {
            popup.off("close", handleClose);
            // Do not remove popup here—let `open` control it.
            // If unmounting the component entirely, cleanup:
            // popup.remove();
        };
    }, [map, open, lngLat, onClose]);

    // 4) Render your React subtree into the popup container (keeps context!)
    return createPortal(children, containerRef.current);
}
