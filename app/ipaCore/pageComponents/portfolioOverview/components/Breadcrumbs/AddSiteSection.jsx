import React, {useContext, useEffect, useMemo} from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import { selectIsSelectingPosition, selectSelectedCoordinate, setDraftSite, setIsSelectingPosition, setSelectedCoordinate } from "../../../../redux/siteSetup";
import { MapContext, PortfolioActorContext } from "../../PortfolioOverview";
import {v4 as uuid} from "uuid";
import { PinDrop } from '@material-ui/icons';
import { defaultNewSiteId } from "../statePanels/SiteDetails";
import { getClickEvent } from "../../../../redux/pageComponentState";
import { addFeatureToMapLayer, removeFeatureFromMapLayer } from "../../../../../client/scripts/mapEntryActions.mjs";
import { Tooltip } from "@material-ui/core";

const AddSiteSection = ({classes, levels}) => {
    const dispatch = useDispatch();

    const selectionPath = useMemo(() => {
        return levels.map(el => el.state).join(".")
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
    const portContext = useContext(PortfolioActorContext);
    const { send, currentState } = portContext || {};

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

        dispatch(setSelectedCoordinate());
        dispatch(setIsSelectingPosition(false));

        if (!removeSuccess) {
            console.warn('Failed to remove draft site feature from map layer');
        }

        // Send event to update XState context (removing the site)
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });
    };

    useEffect(() => {
        if(previousSite?.isDraft && selectionPath === "portfolio"){
            handleCancelSite(previousSite);
        }
    }, [previousSite, selectionPath])
    
    const previousIsSelectingPosition = usePrevious(isSelectingPosition);

    const handleAddSite = () => {
        dispatch(setSelectedCoordinate());
        dispatch(setIsSelectingPosition(!isSelectingPosition));
    };


    useEffect(() => {
        if(previousIsSelectingPosition && isSelectingPosition && clickEvent?.ground){
            dispatch(setSelectedCoordinate([clickEvent.ground.longitude, clickEvent.ground.latitude]));
            dispatch(setIsSelectingPosition(false));
        }
        if(selectedCoordinate?.length && currentState){
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
            
            // Store in Redux as well
            dispatch(setDraftSite(newSite));
            
            // Clear the selected coordinate
            dispatch(setSelectedCoordinate());
            dispatch(setIsSelectingPosition(false));
        }
    }, [previousIsSelectingPosition, isSelectingPosition, selectedCoordinate, clickEvent, currentState, send, dispatch, mapInstance])


    return <div className={isSelectingPosition ? classes.addSiteSectionActive : classes.addSiteSection} onClick={handleAddSite} >
        <Tooltip title="Add Site">
            <PinDrop/>
        </Tooltip>
    </div>
}

export default AddSiteSection;