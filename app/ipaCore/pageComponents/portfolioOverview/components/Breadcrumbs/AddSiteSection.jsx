import React, {useContext, useEffect, useMemo} from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import { selectDraftType, selectIsSelectingPosition, selectSelectedCoordinate, setDraftType, setIsSelectingPosition, setSelectedCoordinate } from "../../../../redux/siteSetup";
import { MapContext, MapMachineContext } from "../../PortfolioOverview";
import {v4 as uuid} from "uuid";
import { PinDrop } from '@material-ui/icons';
import { defaultNewBuildingId, defaultNewSiteId } from "../statePanels/SiteDetails";
import { getClickEvent, getMapTypes, getSelectedGraphicReference } from "../../../../redux/pageComponentState";
import { addFeatureToMapLayer, removeFeatureFromMapLayer, addBuildingToMap, getGeometryInfo } from "../../../../../client/scripts/mapEntryActions.mjs";
import { Tooltip } from "@material-ui/core";
import {useSelector as useXstateSelector} from "@xstate/react";

const AddSiteSection = ({classes, levels}) => {
    const dispatch = useDispatch();

    const [selectionPath, currentElementType] = useMemo(() => {
        const sPath = levels?.map(el => el.state).join(".");
        const cElementType = sPath?.split(".")?.slice(-1)?.[0];
        return [sPath, cElementType]
    })

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

    const clickEvent = useSelector(getClickEvent);
    const isSelectingPosition = useSelector(selectIsSelectingPosition);
    const selectedCoordinate = useSelector(selectSelectedCoordinate);

    const { mapInstance } = useContext(MapContext);
    const portContext = useContext(MapMachineContext);
    const { send, actor } = portContext || {};
    const currentState = useXstateSelector(actor, state => state);

    const {data = [], siteId} = currentState.context;
    const {site = [], building = []} = data;
    const currentSite = site.find(s => s.siteId === siteId);
    const previousSite = usePrevious(currentSite);

    // Handle site cancellation (remove draft site)
    const handleCancelSite = (siteToRemove) => {
        if (!siteToRemove) return;

        // Remove the draft site from the data
        const currentData = currentState.context?.data || {};
        const currentSites = currentData.site || [];

        if(siteToRemove.isDraft){
            const filteredSites = currentSites.filter(s => s.siteId !== siteToRemove.siteId);
            const updatedData = {
                ...currentData,
                site: filteredSites
            };

            const namedPath = currentState.context.namedPaths[0];

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
                s.siteId === siteId ? finalizedSite : s
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


    useEffect(() => {
        if((previousSite?.isDraft || previousSite?.isEditing) && currentElementType !== "site"){
            handleCancelSite(previousSite);
        }
    }, [previousSite, currentElementType])

    const previousIsSelectingPosition = usePrevious(isSelectingPosition);

    const handleAddSite = () => {
        dispatch(setSelectedCoordinate());
        dispatch(setIsSelectingPosition(!isSelectingPosition));
        dispatch(setDraftType(!isSelectingPosition ? "site" : undefined))
    };

    const draftType = useSelector(selectDraftType);
    const selectedGraphicReferecen = useSelector(getSelectedGraphicReference);
    const types = useSelector(getMapTypes);

    const draftTypeSchema = types[draftType];


    useEffect(() => {
        if(previousIsSelectingPosition && isSelectingPosition && clickEvent?.ground){
            dispatch(setSelectedCoordinate([clickEvent.ground.longitude, clickEvent.ground.latitude]));
            dispatch(setIsSelectingPosition(false));
        }
        if(selectedCoordinate?.length && !isSelectingPosition && draftType === "building"){

            const [centerLng, centerLat] = selectedCoordinate;
            
            // Create new building data with mandatory fields
            const newBuilding = {
                buildingId: defaultNewBuildingId,
                name: defaultNewBuildingId, // Use last 8 chars for readable name
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

            console.log("3D_STUFF", {mapInstance, graphicId, geometryInfo})

            // Add 3D model to map if geometry info is available
            if (mapInstance && graphicId && geometryInfo) {
                const success3D = addBuildingToMap({
                    map: mapInstance,
                    buildingId: defaultNewBuildingId,
                    centroid: [centerLng, centerLat],
                    graphicId: graphicId,
                    geometryInfo: geometryInfo,
                    namedPath: currentState.context.namedPaths[0]
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
                    buildingId: defaultNewBuildingId
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

            const newSiteId = defaultNewSiteId;
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
                const namedPath = currentState.context.namedPaths[0]; // Use first named path
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
    }, [previousIsSelectingPosition, isSelectingPosition, selectedCoordinate, clickEvent, draftTypeSchema, draftType, selectedGraphicReferecen, currentState, send, dispatch, mapInstance])


    return <div className={isSelectingPosition ? classes.addSiteSectionActive : classes.addSiteSection} onClick={handleAddSite} >
        <Tooltip title="Add Site">
            <PinDrop/>
        </Tooltip>
    </div>
}

export default AddSiteSection;
