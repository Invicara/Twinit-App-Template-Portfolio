import React, { useMemo, useContext, useEffect } from 'react';
import { makeStyles } from '@material-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { MapContext, PortfolioActorContext } from '../PortfolioOverview';
import { selectIsSelectingPosition, setSelectedCoordinate, setIsSelectingPosition, selectSelectedCoordinate, setDraftSite } from '../../../redux/siteSetup';
import { getClickEvent } from '../../../redux/pageComponentState';
import { usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import {v4 as uuid} from "uuid";
import { addFeatureToMapLayer } from '../../../../client/scripts/mapEntryActions.mjs';
import { PinDrop } from '@material-ui/icons';

// Helper function to execute callbacks sequentially with intervals
function executeSequentialCallbacks(callbacks, intervalMs = 100) {
    if (!Array.isArray(callbacks) || callbacks.length === 0) {
        console.warn('executeSequentialCallbacks: No callbacks provided');
        return;
    }
    
    let currentIndex = 0;
    
    const intervalId = setInterval(() => {
        if (currentIndex >= callbacks.length) {
            clearInterval(intervalId);
            return;
        }
        
        const callback = callbacks[currentIndex];
        if (typeof callback === 'function') {
            try {
                callback();
            } catch (error) {
                console.error(`Error executing callback ${currentIndex}:`, error);
            }
        } else {
            console.warn(`Callback at index ${currentIndex} is not a function:`, callback);
        }
        
        currentIndex++;
    }, intervalMs);
    
    return intervalId; // Return interval ID in case caller wants to clear it manually
}

const AddSiteSection = ({classes}) => {
    const dispatch = useDispatch();

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
    
    const previousIsSelectingPosition = usePrevious(isSelectingPosition);

    const handleAddSite = () => {
        dispatch(setSelectedCoordinate());
        dispatch(setIsSelectingPosition(true));
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

    return <div className={isSelectingPosition ? classes.addSiteSectionActive : classes.addSiteSection} onClick={handleAddSite} >
        <PinDrop/>
    </div>
}

const useStyles = makeStyles((theme) => ({
    container: {
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 14,
        paddingRight: 14,
        width: "100%"
    },
    breadcrumbsSection: {
        display: "flex",
        alignItems: "center"
    },
    crumb: {
        fontWeight: 500,
        margin: 20,
        marginLeft: 0,
        cursor: "pointer",
        color: "white",
        '&:hover': {
            textDecoration: "underline"
        }
    },
    activeCrumb: {
        fontWeight: 700,
        margin: 20,
        marginLeft: 0,
        cursor: "pointer",
        color: "white",
        '&:hover': {
            textDecoration: "underline"
        }
    },
    separator: {
        marginRight: 10
    },
    addSiteSection: {
        display: "flex",
        alignItems: "center",
        height: "100%",
        padding: "0 12px",
        cursor: "pointer",
        color: "white",
        borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
        transition: "background-color 0.2s ease",
        '&:hover': {
            backgroundColor: "rgba(255, 255, 255, 0.1)"
        }
    },
    addSiteSectionActive: {
        display: "flex",
        alignItems: "center",
        height: "100%",
        padding: "0 12px",
        cursor: "pointer",
        color: "#CC3289",
        borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
        backgroundColor: "rgba(204, 50, 137, 0.1)",
        '&:hover': {
            backgroundColor: "rgba(204, 50, 137, 0.2)"
        }
    },
    pinIcon: {
        marginRight: 6,
        width: 16,
        height: 16,
        fill: "currentColor"
    },
    addSiteText: {
        fontSize: 13,
        fontWeight: 500
    }
}));

const PortfolioBreadCrumbs = () => {
    const classes = useStyles();
    const { currentState, send } = useContext(PortfolioActorContext);
    
    const breadcrumbs = useMemo(() => {
        if (!currentState) return [];
        
        const crumbs = [];
        const stateValue = currentState.value;
        const context = currentState.context;
        
        // Helper function to get nested state value
        const getNestedStateValue = (value) => {
            if (typeof value === 'string') return [value];
            if (typeof value === 'object') {
                const result = [];
                for (const [key, nestedValue] of Object.entries(value)) {
                    result.push(key);
                    if (typeof nestedValue === 'object') {
                        result.push(...getNestedStateValue(nestedValue));
                    } else if (typeof nestedValue === 'string') {
                        result.push(nestedValue);
                    }
                }
                return result;
            }
            return [];
        };
        
        const states = getNestedStateValue(stateValue);
        console.log('BreadCrumbs - States:', states, 'Context:', context);
        
        // Portfolio level (always present)
        crumbs.push({
            title: 'Portfolio',
            isActive: states.includes('portfolio') && !context.siteId,
            onClick: () => {
                executeSequentialCallbacks([
                    () => send({ type: 'GO_TO' }),
                    () => send({ type: 'CONFIRM_YES' })
                ], 100);
            }
        });
        
        // Site level
        if (states.includes('site') && context.siteId) {
            const siteData = context.data?.site?.find(s => s.siteId === context.siteId);
            crumbs.push({
                title: siteData?.name || `Site ${context.siteId}`,
                isActive: states.includes('site') && !states.includes('building'),
                onClick: () => {
                    executeSequentialCallbacks([
                        () => send({ 
                            type: 'GO_TO', 
                            siteId: context.siteId 
                        }),
                        () => send({ 
                            type: 'CONFIRM_YES' 
                        })
                    ], 100);
                }
            });
        }
        
        // Building level
        if (states.includes('building') && context.buildingId) {
            const buildingData = context.data?.building?.find(b => b.buildingId === context.buildingId);
            crumbs.push({
                title: buildingData?.name || `Building ${context.buildingId}`,
                isActive: states.includes('building') && !states.includes('modelElement'),
                onClick: () => {
                    executeSequentialCallbacks([
                        () => send({ 
                            type: 'GO_TO', 
                            siteId: context.siteId,
                            buildingId: context.buildingId 
                        }),
                        () => send({ 
                            type: 'CONFIRM_YES' 
                        })
                    ], 100);
                }
            });
        }
        
        // Model Element level
        if (states.includes('modelElement') && context.modelElementId) {
            crumbs.push({
                title: `Model: ${context.modelElementId}`,
                isActive: true, // This is the deepest level
                onClick: () => {
                    executeSequentialCallbacks([
                        () => send({ 
                            type: 'GO_TO', 
                            siteId: context.siteId,
                            buildingId: context.buildingId,
                            modelElementId: context.modelElementId 
                        }),
                        () => send({ 
                            type: 'CONFIRM_YES' 
                        })
                    ], 100);
                }
            });
        }
        
        return crumbs;
    }, [currentState, send]);
    
    return (
        <div className={classes.container}>
            <div className={classes.breadcrumbsSection}>
                {breadcrumbs.map((crumb, index) => {
                    return (
                        <span 
                            className={crumb.isActive ? classes.activeCrumb : classes.crumb}
                            onClick={crumb.onClick} 
                            key={`${crumb.title}-${index}`}
                        >
                            {index > 0 && <span className={classes.separator}>/</span>}
                            {crumb.title}
                        </span>
                    );
                })}
            </div>
            <AddSiteSection {...{classes}}/>
        </div>
    );
};

export default PortfolioBreadCrumbs;
