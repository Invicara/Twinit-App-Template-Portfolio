import React, { useContext, useEffect, useMemo } from "react";
import { useSelector as useXstateSelector } from "@xstate/react";
import { getActiveLevels } from "../../services/utils";
import {get3DGraphicsController, waitForSourceLoaded} from "../../client/scripts/mapEntryActions.mjs";

/**
 * Generic strict predicate:
 * For target level `state`, require all ancestor idKeys (with values present in context)
 * up to and including the target level to match on the row.
 * If any of those idKeys are *missing* from context, returns a predicate that shows nothing.
 */
function buildFilterPredicateFromNamedPath(namedPath, state, context) {
    if (!Array.isArray(namedPath)) return () => false;

    const idx = namedPath.findIndex(l => l.state === state);
    if (idx < 0) return () => false;

    const lvl = namedPath[idx];
    const isMesh = lvl?.feature === "mesh";

    // When feature == "mesh", use ONLY parent constraints (siblings under same parent)
    const endIdx = isMesh ? idx - 1 : idx;

    // If there is no parent to constrain by (endIdx < 0), we render nothing (avoid heavy draw)
    if (endIdx < 0) return () => false;

    // Collect (idKey, contextValue) for all levels up to target that actually have an idKey
    const constraints = [];
    for (let i = 0; i <= endIdx; i++) {
        const idKey = namedPath[i]?.idKey;
        if (!idKey) continue;                  // e.g., portfolio has null idKey
        const val = context?.[idKey];
        if (val == null) {
            continue;
        }
        constraints.push([idKey, val]);
    }

    if (constraints.length === 0) {
        // No constraints (i.e. portfolio) -> allow none
        return () => false;
    }

    return (row) => {
        const props = row || {};
        for (const [k, v] of constraints) {
            if (props[k] != v) return false;
        }
        return true;
    };
}

/**
 * Filters `context.data` for the levels you care about (e.g., feature === "mesh"),
 * using the strict predicate above. Returns per-level id lists.
 *
 * @param {object} context - must include `namedPaths` and `data`
 * @param {function} levelSelector - (lvl) => boolean, e.g., lvl.feature === "mesh"
 * @returns {{visibleByLevel: Record<string,string[]>, hiddenByLevel: Record<string,string[]>, allByLevel: Record<string,string[]>}}
 */
export function filterLevelsGraphicsByNamedPath(context, levelSelector = () => true) {
    const namedPath = context?.namedPaths?.[0] ?? [];
    const result = { visibleByLevel: {}, hiddenByLevel: {}, allByLevel: {} };

    for (const lvl of namedPath) {
        if (!levelSelector(lvl)) continue;

        const state = lvl.state;
        const idKey = lvl.idKey || `${state}Id`;
        const rows = context?.data?.[state] ?? [];

        const pred = buildFilterPredicateFromNamedPath(namedPath, state, context);

        // Pass once over rows: gather all ids and visible ids
        const allIds = [];
        const visIds = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const id = r?.[idKey];
            if (id == null) continue;
            allIds.push(id);
            if (pred(r)) visIds.push(id);
        }

        const visSet = new Set(visIds);
        const hiddenIds = allIds.filter(id => !visSet.has(id));

        result.allByLevel[state] = allIds;
        result.visibleByLevel[state] = visIds;
        result.hiddenByLevel[state] = hiddenIds;
    }

    return result;
}

export function useGraphicsVisibility({mapInstance, portContext, meshLevels}){

    const { send, actor } = portContext || {};
    const currentState = useXstateSelector(actor, state => state);
    const context = currentState.context;
    const visibilityState = useMemo(() => {
        return filterLevelsGraphicsByNamedPath(
            context,
            (lvl) => lvl.feature === "mesh"
        );;
    }, [context, meshLevels]);

    const meshFeaturesPerLevel = visibilityState.visibleByLevel;
    const remainingMeshFeaturesPerLevel = visibilityState.hiddenByLevel;

    // Main effect to handle 3D graphics visibility changes
    useEffect(() => {
        if (!mapInstance || !meshFeaturesPerLevel) {
            console.log('UseGraphicsVisibility: Missing mapInstance or meshFeaturesPerLevel');
            return;
        }

        // Process each level's mesh features
        Object.keys(meshFeaturesPerLevel).forEach(levelKey => {

            // Get the 3D graphics controller for this level
            const sourceId = `${levelKey}-features`;
            const controller = get3DGraphicsController(mapInstance, sourceId);

            const featuresToShow = meshFeaturesPerLevel[levelKey] || [];
            const featuresToHide = remainingMeshFeaturesPerLevel[levelKey] || [];
            console.log("LOOPING_VISIBILITY", {levelKey, featuresToShow, featuresToHide})
            if (!controller) {
                console.warn(`UseGraphicsVisibility: No 3D graphics controller found for level ${levelKey} (sourceId: ${sourceId})`);
                return;
            }

            // Hide removed features
            if (featuresToHide.length > 0) {
                console.log(`UseGraphicsVisibility: Hiding features for ${levelKey}:`, featuresToHide);
                try {
                    controller.hideFeatures(featuresToHide);
                } catch (error) {
                    console.error(`UseGraphicsVisibility: Error hiding features for ${levelKey}:`, error);
                }
            }


            // Show new features
            if (featuresToShow.length > 0) {
                console.log(`UseGraphicsVisibility: Showing features for ${levelKey}:`, featuresToShow);
                try {
                    controller.showFeatures(featuresToShow);
                } catch (error) {
                    console.error(`UseGraphicsVisibility: Error showing features for ${levelKey}:`, error);
                }
            }

            // If no current features, hide the entire layer for performance
            if (featuresToShow.length === 0 && controller.isVisible()) {
                console.log(`UseGraphicsVisibility: Hiding entire layer for ${levelKey} (no features)`);
                controller.hide();
            }

            // If no current features, hide the entire layer for performance
            if (featuresToShow.length > 0 && !controller.isVisible()) {
                console.log(`UseGraphicsVisibility: Showing layer for ${levelKey}`);
                controller.show();
            }
        });

    }, [mapInstance, meshFeaturesPerLevel, remainingMeshFeaturesPerLevel]);

    return <></>
}
