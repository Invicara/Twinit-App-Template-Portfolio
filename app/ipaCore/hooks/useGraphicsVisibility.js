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

    const meshFeaturesPerLevel = useMemo(() => {
        const levels = getActiveLevels(currentState);

        const valuesPerLevelKey = levels
            .map(l => [l.idKey, currentState.context[l.idKey]])
            .filter(([k, v]) => k && v);

        const sPath = levels?.map(el => el.state).join(".");
        const cElementType = sPath?.split(".")?.slice(-1)?.[0];

        const namedPaths = currentState.context.namedPaths[0];
        const namedPath = namedPaths.find(p => p.state === cElementType);
        const lowerNamedPath = namedPaths.find(p => p?.scopeLevel === namedPath?.scopeLevel + 1);


        const meshLevels = levels.concat([lowerNamedPath]).filter(l => l && l?.feature === "mesh");
        const meshFeaturesPerLevel = Object.assign({}, ...meshLevels.map(l => {
            const featureIds = currentState.context.data[l.state]
                .filter(el => valuesPerLevelKey.some(([k, v]) => el[k] === v))
                .map(f => f[l.idKey]);

            return {[l.state]: featureIds}
        }));

        return meshFeaturesPerLevel;

    }, [currentState]);

    const prevMeshFeaturesPerLevel = usePrevious(meshFeaturesPerLevel);

    // Main effect to handle 3D graphics visibility changes
    useEffect(() => {
        if (!mapInstance || !meshFeaturesPerLevel) {
            console.log('UseGraphicsVisibility: Missing mapInstance or meshFeaturesPerLevel');
            return;
        }

        console.log('UseGraphicsVisibility: Processing visibility changes', {
            current: meshFeaturesPerLevel,
            previous: prevMeshFeaturesPerLevel
        });

        // Process each level's mesh features
        Object.keys(meshFeaturesPerLevel).forEach(levelKey => {
            const currentFeatures = meshFeaturesPerLevel[levelKey] || [];
            const previousFeatures = prevMeshFeaturesPerLevel?.[levelKey] || [];

            // Skip if no changes for this level
            if (JSON.stringify(currentFeatures) === JSON.stringify(previousFeatures)) {
                console.log(`UseGraphicsVisibility: No changes for level ${levelKey}`);
                return;
            }

            console.log(`UseGraphicsVisibility: Processing level ${levelKey}`, {
                current: currentFeatures,
                previous: previousFeatures
            });

            // Get the 3D graphics controller for this level
            const sourceId = `${levelKey}-features`;
            const controller = get3DGraphicsController(mapInstance, sourceId);

            if (!controller) {
                console.warn(`UseGraphicsVisibility: No 3D graphics controller found for level ${levelKey} (sourceId: ${sourceId})`);
                return;
            }

            // First, ensure the layer is visible if we have features to show
            if (currentFeatures.length > 0 && !controller.isVisible()) {
                console.log(`UseGraphicsVisibility: Enabling layer visibility for ${levelKey}`);
                controller.show();
            }

            // Find features to show (new features that weren't in previous)
            const featuresToShow = currentFeatures.filter(featureId => 
                !previousFeatures.includes(featureId)
            );

            // Find features to hide (features that were in previous but not in current)
            const featuresToHide = previousFeatures.filter(featureId => 
                !currentFeatures.includes(featureId)
            );

            // Show new features
            if (featuresToShow.length > 0) {
                console.log(`UseGraphicsVisibility: Showing features for ${levelKey}:`, featuresToShow);
                try {
                    controller.showFeatures(featuresToShow);
                } catch (error) {
                    console.error(`UseGraphicsVisibility: Error showing features for ${levelKey}:`, error);
                }
            }

            // Hide removed features
            if (featuresToHide.length > 0) {
                console.log(`UseGraphicsVisibility: Hiding features for ${levelKey}:`, featuresToHide);
                try {
                    controller.hideFeatures(featuresToHide.filter(f => !f.includes(defaultNewBuildingId)));
                } catch (error) {
                    console.error(`UseGraphicsVisibility: Error hiding features for ${levelKey}:`, error);
                }
            }

            // If no current features, hide the entire layer for performance
            if (currentFeatures.length === 0 && controller.isVisible()) {
                console.log(`UseGraphicsVisibility: Hiding entire layer for ${levelKey} (no features)`);
                controller.hide();
            }
        });

        // Handle levels that existed previously but don't exist now
        if (prevMeshFeaturesPerLevel) {
            Object.keys(prevMeshFeaturesPerLevel).forEach(levelKey => {
                if (!meshFeaturesPerLevel[levelKey]) {
                    console.log(`UseGraphicsVisibility: Level ${levelKey} no longer exists, hiding all features`);
                    
                    const sourceId = `${levelKey}-features`;
                    const controller = get3DGraphicsController(mapInstance, sourceId);
                    
                    if (controller && controller.isVisible()) {
                        console.log(`UseGraphicsVisibility: Hiding entire layer for removed level ${levelKey}`);
                        controller.hide();
                    }
                }
            });
        }

    }, [mapInstance, meshFeaturesPerLevel, prevMeshFeaturesPerLevel]);

    // Debug effect to log state changes
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('UseGraphicsVisibility: State update', {
                meshFeaturesPerLevel,
                prevMeshFeaturesPerLevel,
                hasMapInstance: !!mapInstance
            });
        }
    }, [meshFeaturesPerLevel, prevMeshFeaturesPerLevel, mapInstance]);

    return <></>
}
