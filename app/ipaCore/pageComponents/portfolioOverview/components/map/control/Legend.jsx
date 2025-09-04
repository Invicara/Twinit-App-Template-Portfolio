import React, {useContext, useEffect, useState} from "react";
import {LegendControl} from "./LegendControl.js";
import './Legend.scss'
import {MapMachineContext} from "../../../PortfolioOverview.jsx";
import {useSelector as useXstateSelector} from "@xstate/react";
import {createPortal} from "react-dom";

function LegendUI({ theme = {}, path, title = "Legend" }) {
    const layerId = `${path}-features-layer`;
    const bins = theme[layerId]?.bins || [];
    if(bins.length === 0) return null;
    return (
        <div style={{minWidth: 210 }} className={"overview-legend"}>
            <span style={{ margin: "0 0 8px 0" }}>{title}</span>
            {bins.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
                    {/* SVG circle to match Mapbox circle layer look */}
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                        <circle
                            cx="9" cy="9" r={b['circle-radius'] || 7}
                            fill={b.color}
                            stroke="#ffffff"
                            strokeWidth="2"
                        />
                    </svg>
                    <span>{b.label}</span>
                </div>
            ))}
        </div>
    );
}

function LegendPortal({ path, target }) {
    const { actor } = useContext(MapMachineContext);
    const { theme } = useXstateSelector(actor, state => state.context);
    if (!target) return null;
    return createPortal(<LegendUI theme={theme} path={path} />, target);
}

export function Legend({map, path}) {
    const [portalEl, setPortalEl] = useState(null);
    //const ctrlRef = useRef(null);

    useEffect(() => {
        if (!map) return;
        const ctrl = new LegendControl({ onReady: setPortalEl });
        //ctrlRef.current = ctrl;
        map.addControl(ctrl, "bottom-left");
        return () => { try { map.removeControl(ctrl); } catch {} };
    }, [map]);

    return <LegendPortal path={path} target={portalEl} />;
}
