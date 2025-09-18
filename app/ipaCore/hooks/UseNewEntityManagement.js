import React, { useContext, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import { 
    selectDraftType, 
    selectIsSelectingPosition, 
    selectSelectedCoordinate, 
    setDraftType, 
    setIsSelectingPosition, 
    setSelectedCoordinate 
} from "../redux/siteSetup";
import { v4 as uuid } from "uuid";
import { getClickEvent, getMapTypes, getSelectedGraphicReference } from "../redux/pageComponentState";
import { addFeatureToMapLayer, removeFeatureFromMapLayer, addBuildingToMap, getGeometryInfo } from "../../client/scripts/mapEntryActions.mjs";
import { useSelector as useXstateSelector } from "@xstate/react";
import _ from "lodash";
import { getActiveLevels } from "../../services/utils";

export const defaultNewSiteId = "<newSite>";
export const defaultNewBuildingId = "<newBuilding>";


export const useNewEntityManagement = ({portContext, mapInstance}) => {

    const dispatch = useDispatch();
    
    const clickEvent = useSelector(getClickEvent);
    const isSelectingPosition = useSelector(selectIsSelectingPosition);
    const selectedCoordinate = useSelector(selectSelectedCoordinate);
    const draftType = useSelector(selectDraftType);
    const selectedGraphicReferecen = useSelector(getSelectedGraphicReference);
    const types = useSelector(getMapTypes);

    const { send, actor } = portContext || {};
    const currentState = useXstateSelector(actor, state => state);

    const [currentElementType, namedPathDict] = useMemo(() => {
        const namedPaths = currentState.context.namedPaths[0];

        const namedPathDict = Object.assign({}, ...namedPaths.map(p => ({[p.state]: p})));

        const levels = getActiveLevels(currentState);

        const sPath = levels?.map(el => el.state).join(".");
        const cElementType = sPath?.split(".")?.slice(-1)?.[0];
        return [cElementType, namedPathDict]

    }, [currentState])

    const previousClick = usePrevious(clickEvent);
    const previousIsSelectingPosition = usePrevious(isSelectingPosition);
    
    const draftTypeSchema = types[draftType];

    // Function to generate square coordinates around a centroid
    // widthInMeters: width of the square in meters (default 500m)
    // Returns array of [lng, lat] coordinates forming a closed polygon
    function generateSquareCoordinates(centerLng, centerLat, widthInMeters = 500) {
        // Convert meters to degrees (rough approximation)
        // 1 degree of longitude ≈ 111,320 meters * cos(latitude)
        // 1 degree of latitude ≈ 110,540 meters
        const halfWidthLng = (widthInMeters / 2) / (111320 * Math.cos(centerLat * Math.PI / 180));
        const halfWidthLat = (widthInMeters / 2) / 110540;

        // Create square coordinates (clockwise from top-left)
        return [
            [centerLng - halfWidthLng, centerLat + halfWidthLat], // Top-left
            [centerLng + halfWidthLng, centerLat + halfWidthLat], // Top-right
            [centerLng + halfWidthLng, centerLat - halfWidthLat], // Bottom-right
            [centerLng - halfWidthLng, centerLat - halfWidthLat], // Bottom-left
            [centerLng - halfWidthLng, centerLat + halfWidthLat]  // Close polygon
        ];
    }

    // Handle site cancellation (remove draft site) - extracted from line 59
    const handleCancelSite = (siteToRemove) => {
        if (!siteToRemove && currentElementType !== "site") return;

        // Remove the draft site from the data
        const currentData = currentState.context?.data || {};
        const currentSites = currentData.site || [];

        if(siteToRemove.isDraft){
            const filteredSites = currentSites.filter(s => s.siteId !== siteToRemove.siteId);
            const updatedData = {
                ...currentData,
                site: filteredSites
            };

            const namedPath = currentState.context.namedPaths[0].find(p => p.state === "site"); // Use first named path

            const removeSuccess = removeFeatureFromMapLayer({
                map: mapInstance,
                levelState: 'site',
                featureId: siteToRemove.siteId,
                idKey: 'siteId', // explicitly specify the key for site identification
                namedPath: namedPath
            });

            if (!removeSuccess) {
                console.warn('Failed to remove draft site feature from map layer');
            }

            // Send event to update XState context (removing the site)
            send({
                type: 'UPDATE_DATA',
                data: updatedData
            });
        } else {
            
            const finalizedSite = {...siteToRemove}
            delete finalizedSite.isEditing;

            const updatedSites = currentSites.map(s => 
                s.siteId === currentState.context.siteId ? finalizedSite : s
            );

            const updatedData = {
                ...currentData,
                site: updatedSites
            };

            send({
                type: 'UPDATE_DATA',
                data: updatedData
            });
        }

        dispatch(setSelectedCoordinate());
        dispatch(setIsSelectingPosition(false));
    };

    const {data = [], siteId} = currentState.context;
    const {site = [], building = []} = data;
    const currentSite = site.find(s => s.siteId === siteId);
    const previousSite = usePrevious(currentSite);
    
    // Function to generate square coordinates around a centroid
    function generateSquareCoordinates(centerLng, centerLat, widthInMeters = 500) {
        const halfWidthLng = (widthInMeters / 2) / (111320 * Math.cos(centerLat * Math.PI / 180));
        const halfWidthLat = (widthInMeters / 2) / 110540;

        return [
            [centerLng - halfWidthLng, centerLat + halfWidthLat], // Top-left
            [centerLng + halfWidthLng, centerLat + halfWidthLat], // Top-right
            [centerLng + halfWidthLng, centerLat - halfWidthLat], // Bottom-right
            [centerLng - halfWidthLng, centerLat - halfWidthLat], // Bottom-left
            [centerLng - halfWidthLng, centerLat + halfWidthLat]  // Close polygon
        ];
    }

    // First useEffect - extracted from line 117
    useEffect(() => {
        if(currentSite !== previousSite && previousSite?.isDraft){
            handleCancelSite(previousSite);
        }
    }, [currentSite, previousSite, currentElementType, handleCancelSite]);

    // Second useEffect - extracted from line 138
    useEffect(() => {
        if(previousIsSelectingPosition && isSelectingPosition && clickEvent?.ground && !_.isEqual(previousClick, clickEvent)){
            dispatch(setSelectedCoordinate([clickEvent.ground.longitude, clickEvent.ground.latitude]));
            dispatch(setIsSelectingPosition(false));
        }
        if(selectedCoordinate?.length && !isSelectingPosition && draftType === "building"){

            const [centerLng, centerLat] = selectedCoordinate;
            const newBuildingId = `${defaultNewBuildingId}-${+new Date()}`
            
            // Create new building data with mandatory fields
            const newBuilding = {
                buildingId: newBuildingId,
                name: newBuildingId, // Use last 8 chars for readable name
                siteId: currentState.context.siteId, // Get siteId from current context
                longitude: centerLng,
                Longitude: centerLng,
                latitude: centerLat,
                Latitude: centerLat,
                graphicRefId: selectedGraphicReferecen._id,
                isDraft: true
            };

            // Update XState context by appending to context.data.building
            const currentData = currentState.context?.data || {};
            const currentBuildings = currentData.building || [];
            const updatedData = {
                ...currentData,
                building: [...currentBuildings, newBuilding]
            };

            // Send UPDATE_DATA event to update XState context with new building data
            send({
                type: 'UPDATE_DATA',
                data: updatedData
            });

            // Get geometry info from selectedGraphicReference for 3D model placement
            let geometryInfo = null;
            let graphicId = null;
            
            if (selectedGraphicReferecen && selectedGraphicReferecen._id) {
                graphicId = selectedGraphicReferecen.graphic;
                geometryInfo = getGeometryInfo(graphicId);
                console.log('Retrieved geometry info for graphic:', graphicId, geometryInfo);
            }

            const namedPath = currentState.context.namedPaths[0].find(p => p.state === "building"); // Use first named path

            // Add 3D model to map if geometry info is available
            if (mapInstance && graphicId && geometryInfo) {
                const success3D = addBuildingToMap({
                    entityType: draftType,
                    map: mapInstance,
                    buildingId: newBuildingId,
                    centroid: [centerLng, centerLat],
                    graphicId: graphicId,
                    geometryInfo: geometryInfo,
                    namedPath: namedPath
                });
                 
                if (success3D) {
                    console.log('Successfully added new building to 3D map layer');
                } else {
                    console.warn('Failed to add new building to 3D map layer');
                }
            } else {
                console.warn('No geometry info available for 3D building placement. GraphicId:', graphicId, 'GeometryInfo:', geometryInfo);
            }

            // Navigate to the newly created building using GO_TO with buildingId
            setTimeout(() => {
                send({
                    type: 'GO_TO',
                    siteId: currentState.context.siteId,
                    buildingId: newBuildingId
                });
            }, 100);

            // Clear the selected coordinate
            dispatch(setSelectedCoordinate());
            dispatch(setIsSelectingPosition(false));
            dispatch(setDraftType());
            dispatch(setSelectedCoordinate([]));
      
        }
        if(selectedCoordinate?.length && !isSelectingPosition && draftType === "site"){
            const [centerLng, centerLat] = selectedCoordinate;

            // Generate square coordinates around the selected point (500m width)
            const squareCoords = generateSquareCoordinates(centerLng, centerLat, 500);

            const newSiteId = `${defaultNewSiteId}-${+new Date()}`;
            const newSite = {
                requestId: uuid(),
                isDraft: true,
                name: newSiteId,
                coordinates: [squareCoords], // GeoJSON Polygon format
                siteId: newSiteId
            };

            // Update XState context by appending to context.data.site
            const currentData = currentState.context?.data || {};
            const currentSites = currentData.site || [];
            const updatedData = {
                ...currentData,
                site: [...currentSites, newSite]
            };

            // Send event to update XState context with new data
            send({
                type: 'UPDATE_DATA',
                data: updatedData
            });

            // Add the new site to the map layer
            if (mapInstance && currentState.context?.namedPaths) {
                const namedPath = currentState.context.namedPaths[0].find(p => p.state === "site"); // Use first named path
                const success = addFeatureToMapLayer({
                    map: mapInstance,
                    levelState: 'site',
                    feature: newSite,
                    namedPath: namedPath
                });

                if (success) {
                    console.log('Successfully added new site to map layer');
                    // Trigger map refresh/repaint
                    mapInstance.triggerRepaint();
                } else {
                    console.warn('Failed to add new site to map layer');
                }
            }

            // Navigate to the newly created site
            setTimeout(() => {
                send({
                    type: 'GO_TO',
                    siteId: newSiteId
                });
            }, 100);

            // Clear the selected coordinate
            dispatch(setSelectedCoordinate());
            dispatch(setIsSelectingPosition(false));
            dispatch(setDraftType());
            dispatch(setSelectedCoordinate([]));
        }
    }, [previousIsSelectingPosition, isSelectingPosition, selectedCoordinate, previousClick, clickEvent, draftTypeSchema, draftType, selectedGraphicReferecen, currentState, send, dispatch, mapInstance]);

    return <></>
};
