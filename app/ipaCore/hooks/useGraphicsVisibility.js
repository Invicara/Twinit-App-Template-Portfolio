import React, { useContext, useEffect, useMemo } from "react";
import { MapContext, MapMachineContext } from "../pageComponents/portfolioOverview/PortfolioOverview";
import { useSelector as useXstateSelector } from "@xstate/react";
import { getActiveLevels } from "../../services/utils";
import { usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import { get3DGraphicsController } from "../../client/scripts/mapEntryActions.mjs";
import { defaultNewBuildingId } from "./useEntityManagement";


export function useGraphicsVisibility({mapInstance, portContext}){

    const { send, actor } = portContext || {};
    const currentState = useXstateSelector(actor, state => state);

    const [meshFeaturesPerLevel, remainingMeshFeaturesPerLevel] = useMemo(() => {
        const levels = getActiveLevels(currentState);

        const valuesPerLevelKey = levels
            .map(l => [l.idKey, currentState.context[l.idKey]])
            .filter(([k, v]) => k && v);

        const sPath = levels?.map(el => el.state).join(".");
        const cElementType = sPath?.split(".")?.slice(-1)?.[0];

        const namedPaths = currentState.context.namedPaths[0];
        const namedPath = namedPaths.find(p => p.state === cElementType);
        const lowerNamedPath = namedPaths.find(p => p?.scopeLevel === namedPath?.scopeLevel + 1);


        const meshLevels = [...levels, ...(lowerNamedPath ? [lowerNamedPath] : [])]
            .filter(l => l && l.feature === 'mesh');

        /* prev - only features matching each level
        const meshFeaturesPerLevel = Object.assign({}, ...meshLevels.map(l => {
            const featureIds = currentState.context.data[l.state]
                .filter(el => valuesPerLevelKey.every(([k, v]) => el[k] === v))
                .map(f => f[l.idKey]);

            return {[l.state]: featureIds}
        }));
        */

        //new requirement - show buildings that belong to the same parent as well
        //so you can position them relative to the other buildings
        const meshFeaturesPerLevel = Object.assign({}, ...meshLevels.map(l => {
            const parentPath   = (currentState.context.namedPaths[0] || []).find(p => p.state === l.parentState);
            const parentIdKey  = parentPath?.idKey;
            const parentIdVal  = parentIdKey ? currentState.context[parentIdKey] : undefined;
            let featureIds = [];
            if(parentIdKey && parentIdVal != null) {
                featureIds = (currentState.context.data[l.state] || [])
                    // if this level has a parent, require child[parentIdKey] === context[parentIdKey]
                    .filter(f => f[parentIdKey] === parentIdVal)
                    .map(f => f[l.idKey]);
            } else {
                featureIds = (currentState.context.data[l.state] || [])
                    .filter(f => valuesPerLevelKey.every(([k, v]) => f[k] === v))
                    .map(f => f[l.idKey]);
            }
            return { [l.state]: featureIds };
        }));

        const remainingMeshFeaturesPerLevel = Object.assign({}, ...meshLevels.map(l => {
            const allIds = currentState.context.data[l.state].map(f => f[l.idKey]);
            const showIds = meshFeaturesPerLevel[l.state] || [];
            const hideIds = allIds.filter(id => !showIds.includes(id));
            return { [l.state]: hideIds };
        }));

        return [meshFeaturesPerLevel, remainingMeshFeaturesPerLevel];

    }, [currentState]);

    // Main effect to handle 3D graphics visibility changes
    useEffect(() => {
        if (!mapInstance || !meshFeaturesPerLevel) {
            console.log('UseGraphicsVisibility: Missing mapInstance or meshFeaturesPerLevel');
            return;
        }

        // Process each level's mesh features
        Object.keys(meshFeaturesPerLevel).forEach(levelKey => {
            const featuresToShow = meshFeaturesPerLevel[levelKey] || [];
            const featuresToHide = remainingMeshFeaturesPerLevel[levelKey] || [];

            // Get the 3D graphics controller for this level
            const sourceId = `${levelKey}-features`;
            const controller = get3DGraphicsController(mapInstance, sourceId);

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
