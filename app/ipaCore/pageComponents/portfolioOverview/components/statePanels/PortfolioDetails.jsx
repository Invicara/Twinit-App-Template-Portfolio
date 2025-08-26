import React, { useContext, useEffect } from 'react';
import { Typography, Divider, Button } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsSelectingPosition, selectSelectedCoordinate, setDraftSite, setIsSelectingPosition, setSelectedCoordinate } from '../../../../redux/siteSetup';
import { getClickEvent } from '../../../../redux/pageComponentState';
import { MapContext, PortfolioActorContext } from '../../PortfolioOverview';
import {v4 as uuid} from "uuid";
import { addFeatureToMapLayer } from '../../../../../client/scripts/mapEntryActions.mjs';
import { usePrevious } from "@invicara/ipa-core/modules/IpaUtils";

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

export default function PortfolioDetails({ context }) {
    const dispatch = useDispatch();

    const clickEvent = useSelector(getClickEvent);
    const isSelectingPosition = useSelector(selectIsSelectingPosition);
    const selectedCoordinate = useSelector(selectSelectedCoordinate);

    const { mapInstance } = useContext(MapContext);
    const portContext = useContext(PortfolioActorContext);
    const { actor, send, currentState } = portContext || {};
    const {data = {}} = context;

    const {building: buildings = []} = data;
    
    const handleAddSite = () => {
        dispatch(setSelectedCoordinate());
        dispatch(setIsSelectingPosition(true));
    };

    const previousIsSelectingPosition = usePrevious(isSelectingPosition);

    Object.entries({isSelectingPosition, selectedCoordinate, clickEvent, currentState, send, dispatch}).forEach(([k, v]) => window[k] = v)

    useEffect(() => {
        if(previousIsSelectingPosition && isSelectingPosition && clickEvent?.ground){
            dispatch(setSelectedCoordinate([clickEvent.ground.longitude, clickEvent.ground.latitude]));
            dispatch(setIsSelectingPosition(false));
        }
        if(selectedCoordinate?.length && currentState){
            const [centerLng, centerLat] = selectedCoordinate;
            
            // Generate square coordinates around the selected point (500m width)
            const squareCoords = generateSquareCoordinates(centerLng, centerLat, 500);
            
            const newSiteId = "<newSite>";
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
            console.log("updatedData", updatedData)
            
            // Send event to update XState context with new data
            send({
                type: 'UPDATE_DATA',
                data: updatedData
            });
            console.log("updatedData, UPDATED")
            
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


    console.log("clickEvent", clickEvent)

    return (
        <div>
            <Typography variant="h6">Portfolio</Typography>
            <Typography variant="body2">Total: {buildings.length}</Typography>
            <Divider sx={{ my: 2 }} />
            {buildings.map((item, i) => (
                <Typography key={i} variant="body2">
                    {item.name}
                </Typography>
            ))}

            <Button 
                variant="contained" 
                style={{backgroundColor: "#CC3289"}}
                onClick={handleAddSite}
                sx={{ mt: 2 }}
            >
                ADD site
            </Button>
        </div>
    );
}
