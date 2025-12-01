import React, { useMemo } from "react";
import {get} from "lodash";
import { useSelector as useXstateSelector } from "@xstate/react";

const SPACING = {
    titleBottom: 8,        // px under the title
    descBottom: 6,         // px under the description
    statusTop: 2,          // px above the status row
    badgeGap: 4,           // horizontal gap between badges
    badgeWrapGap: 4,       // vertical gap between wrapped rows
};

function Title({ children }) {
    return (
        <div
            style={{
                fontWeight: 600,
                lineHeight: 1.2,
                marginBottom: SPACING.titleBottom,
            }}
        >
            {children}
        </div>
    );
}

function Description({ children }) {
    if (!children) return null;
    return (
        <div
            style={{
                opacity: 0.85,
                fontSize: 12,
                lineHeight: 1.2,
                marginBottom: SPACING.descBottom,
            }}
        >
            {children}
        </div>
    );
}

function StatusRow({ children }) {
    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: `${SPACING.badgeWrapGap}px ${SPACING.badgeGap}px`, // row & column gaps
                marginTop: SPACING.statusTop,
            }}
        >
            {children}
        </div>
    );
}

// tiny badge for multi-mode
function StatusBadge({ label, color, count }) {
    return (
        <span
            //className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",       // space between count and label
                padding: "0 0.5rem",  // pill padding
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 600,
                background: color ?? "#ccc",
                color: "#fff",
                lineHeight: 1.4,
                marginRight: "0.25rem", // spacing between badges
                marginBottom: "0.25rem" // wrap spacing
            }}
            title={label}
        >
      {count != null ? <span>{count}</span> : null}
            <span>{label}</span>
    </span>
    );
}

function StatusDot({ color }) {
    return (
        <span
            aria-hidden
            style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "9999px",
                background: color ?? "#ccc",
                flex: "0 0 auto",
            }}
        />
    );
}

function humanize(s) {
    if (!s) return "";
    return String(s)
        .replace(/[_\-.]+/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

export default function StatusPopup({ data: initialData, actor, config = {}, className }) {
    const { statusPopup } = config;
    const {
        titleProp,
        descriptionProp,
        statusProp,          // string path OR function
        statusConfig,
        statusAggregation,
        maxWidth = 260
    } = statusPopup || {};

    // Subscribe to XState changes and merge with popup data
    const currentState = useXstateSelector(actor, state => state);
    const data = useMemo(() => {
        // If the popup data's ID matches an entity in the current state, use the updated entity data
        if (initialData && currentState?.context?.data) {
            const entityType = statusPopup.entityType || Object.keys(currentState.context.data).find(type =>
                currentState.context.data[type].some(entity =>
                    entity.buildingId === initialData.buildingId ||
                    entity.siteId === initialData.siteId ||
                    entity._id === initialData._id
                )
            );

            const namedPaths = currentState.context.namedPaths[0];
            const namedPath = namedPaths.find(p => p.state === entityType);
            const { idKey } = namedPath || {};

            if (entityType) {
                const updatedEntity = currentState.context.data[entityType]
                    .find(entity => entity[idKey] === initialData?.properties?.[idKey]);

                if (updatedEntity) {
                    return { ...initialData, properties: {
                        ...initialData.properties,
                        ...updatedEntity
                    }};
                }
            }
        }
        return initialData;
    }, [initialData, currentState]);

    const title = titleProp ? get(data, titleProp, "") : "";
    const description = descriptionProp ? get(data, descriptionProp, "") : undefined;

    // Helpers/context we pass if statusProp is a function
    const ctx = {
        aggregation: statusAggregation,
        maps: statusConfig,
    };

    // Resolve status value
    let statusValue;
    if (typeof statusProp === "function") {
        // function can return:
        // - a single id string (e.g., "4")
        // - "unknown"
        // - or { mode: "multi", counts: { "4": 2, "2": 1 } }
        statusValue = statusProp(data, ctx);
    } else {
        statusValue = statusProp ? String(get(data, statusProp, "unknown")) : undefined;
    }

    const isMulti =
        statusValue && typeof statusValue === "object" && statusValue.mode === "multi";

    // Single status branch
    const singleStatusId = !isMulti ? String(statusValue ?? "unknown") : undefined;
    const labelMap = statusConfig?.labelMap || {};
    const colorMap = statusConfig?.colorMap || {};
    const singleLabel =
        !isMulti &&
        (labelMap[singleStatusId] ||
            (typeof singleStatusId === "string" ? humanize(singleStatusId) : undefined));
    const singleColor = !isMulti ? colorMap[singleStatusId] : undefined;

    return (
        <div style={{ maxWidth: 280, fontSize: 14, lineHeight: 1.2, color: "#fff" }}>
            {title ? <Title>{title}</Title> : null}
            {description ? <Description>{description}</Description> : null}

            {/* single status */}
            {!isMulti && singleStatusId ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: SPACING.statusTop }}>
                    <StatusDot color={singleColor}/>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{singleLabel ?? String(singleStatusId)}</span>
                </div>
            ) : null}

            {/* multi status */}
            {isMulti ? (
                <StatusRow>
                    {Object.entries(statusValue.counts).map(([id, count]) => (
                        <StatusBadge
                            key={id}
                            count={count}
                            label={labelMap[id] ?? humanize(id)}
                            color={colorMap[id] ?? "#ccc"}
                        />
                    ))}
                </StatusRow>
            ) : null}
        </div>
    );
}
