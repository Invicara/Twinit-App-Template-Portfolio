import React, { useContext, useEffect, useRef, useState } from 'react';
import { Typography, Divider, Button, Alert, Box } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { PortfolioActorContext, MapContext } from '../../PortfolioOverview';
import { getClickEvent } from '../../../../redux/pageComponentState';
import { addFeatureToMapLayer, removeFeatureFromMapLayer } from '../../../../../client/scripts/mapEntryActions.mjs';
import { usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import { InfoComponent } from '../../../../components/InfoComponent/InfoComponent';
import { useDebounce } from '../../../../hooks/useDebounce';
import { setIsSelectingPosition, setSelectedCoordinate } from '../../../../redux/siteSetup';

export default function SiteDetails({ context }) {
    const {data = [], siteId} = context;
    const {site = [], building = []} = data;
    const buildings = building.filter(d => d.siteId == siteId);
    const currentSite = site.find(s => s.siteId === siteId);
    const plantName = siteId;

    // Get contexts and state
    const { send, currentState } = useContext(PortfolioActorContext);
    const { mapInstance } = useContext(MapContext);
    const dispatch = useDispatch();
    const clickEvent = useSelector(getClickEvent);

    const namedPath = currentState.context.namedPaths[0];

    // Drawing state
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [currentDrawingPins, setCurrentDrawingPins] = useState([]);
    const currentDrawingPinsTracker = useRef(currentDrawingPins);
    
    // Cache for original perimeter when entering drawing mode
    const [cachedPerimeter, setCachedPerimeter] = useState(null);

    // Check if this site is a draft that needs perimeter drawing
    const isDraftSite = currentSite?.isDraft === true;

    const prevIsDrawingMode = usePrevious(isDrawingMode);

    // Site editing configuration for InfoComponent
    const siteEditingConfig = [
        ['name', { title: 'Site Name', readOnly: false, description: 'Name of the site' }],
        ['siteId', { title: 'Site ID', readOnly: false, description: 'Unique identifier for the site' }]
    ];

    // Handle site property changes
    const handleSiteChange = (newValue, propertyName, metadata) => {
        if (!currentSite) return;

        // Store the old siteId for comparison
        const oldSiteId = currentSite.siteId;

        // Update the site object
        const updatedSite = {
            ...currentSite,
            [propertyName]: newValue
        };

        // Update XState context
        const currentData = currentState.context?.data || {};
        const currentSites = currentData.site || [];
        const updatedSites = currentSites.map(s => 
            s.siteId === siteId ? updatedSite : s
        );
        const updatedData = {
            ...currentData,
            site: updatedSites
        };

        // Send event to update XState context with new data
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });

        // If siteId was changed, navigate to the new siteId to maintain selection
        if (propertyName === 'siteId' && newValue !== oldSiteId && newValue.length) {
            console.log('SiteId changed, navigating to new site:', { oldSiteId, newSiteId: newValue });
            
            // Send GO_TO action to navigate to the updated siteId
            send({
                type: 'GO_TO',
                siteId: newValue
            });

            const removeSuccess2 = removeFeatureFromMapLayer({
                map: mapInstance,
                levelState: 'site',
                featureId: oldSiteId,
                idKey: 'siteId', // explicitly specify the key for site identification
                namedPath: namedPath
            });

            const addSuccess = addFeatureToMapLayer({
                map: mapInstance,
                levelState: 'site',
                feature: {
                    properties: updatedSite,
                    geometry: updatedSite.coordinates ? {
                        type: 'Polygon',
                        coordinates: updatedSite.coordinates
                    } : null,
                    coordinates: updatedSite.coordinates // fallback for coordinate extraction
                },
                namedPath: namedPath
            });

        }

        console.log('Site property updated:', { propertyName, newValue, updatedSite });
    };

    // Handle site submission (finalize draft)
    const handleSubmitSite = () => {
        if (!currentSite || !mapInstance || !currentState.context?.namedPaths) return;

        // Get the namedPath for map operations
        const namedPath = currentState.context.namedPaths[0];

        // Step 2: Update the site to mark it as no longer draft
        const finalizedSite = { ...currentSite };
        delete finalizedSite.isDraft;

        // Update XState context
        const currentData = currentState.context?.data || {};
        const currentSites = currentData.site || [];
        const updatedSites = currentSites.map(s => 
            s.siteId === siteId ? finalizedSite : s
        );
        const updatedData = {
            ...currentData,
            site: updatedSites
        };

        // Send event to update XState context with finalized site
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });

        // Step 4: Pre-select the new site with a GO_TO operation
        send({
            type: 'GO_TO',
            siteId: finalizedSite.siteId
        });

        console.log('Site submitted and finalized:', finalizedSite);
    };

    // Handle site cancellation (remove draft site)
    const handleCancelSite = () => {
        if (!currentSite) return;

        // Remove the draft site from the data
        const currentData = currentState.context?.data || {};
        const currentSites = currentData.site || [];
        const filteredSites = currentSites.filter(s => s.siteId !== siteId);
        const updatedData = {
            ...currentData,
            site: filteredSites
        };

        const namedPath = currentState.context.namedPaths[0];

        const removeSuccess = removeFeatureFromMapLayer({
            map: mapInstance,
            levelState: 'site',
            featureId: currentSite.siteId,
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

        // Navigate back to portfolio level
        send({
            type: 'GO_TO',
            level: 'portfolio'
        });

        console.log('Draft site cancelled and removed:', { siteId, removedSite: currentSite });
    };

    useEffect(() => {
        if (!mapInstance || !isDrawingMode) return;

        // Add drawing layers for visual feedback if they don't exist
        if (!mapInstance.getSource('drawing-pins')) {
            mapInstance.addSource('drawing-pins', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
        }

        if (!mapInstance.getSource('drawing-lines')) {
            mapInstance.addSource('drawing-lines', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
        }

        if (!mapInstance.getLayer('drawing-pins-layer')) {
            mapInstance.addLayer({
                id: 'drawing-pins-layer',
                type: 'circle',
                source: 'drawing-pins',
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#ff0000',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });
        }

        if (!mapInstance.getLayer('drawing-lines-layer')) {
            mapInstance.addLayer({
                id: 'drawing-lines-layer',
                type: 'line',
                source: 'drawing-lines',
                paint: {
                    'line-color': '#ff0000',
                    'line-width': 2,
                    'line-dasharray': [2, 2]
                }
            });
        }
    }, [mapInstance, isDrawingMode]);

    // Effect to manage perimeter visibility during drawing mode
    useEffect(() => {
        if (!mapInstance) return;

        const siteLayerId = 'site-features-layer';
        const layerExists = mapInstance.getLayer(siteLayerId);
        
        if (layerExists) {
            if (isDrawingMode) {
                // Hide the current perimeter layer when drawing
                mapInstance.setLayoutProperty(siteLayerId, 'visibility', 'none');
            } else {
                // Show the perimeter layer when not drawing
                mapInstance.setLayoutProperty(siteLayerId, 'visibility', 'visible');
            }
        }
    }, [mapInstance, isDrawingMode]);

    useEffect(() => {
       currentDrawingPinsTracker.current =  currentDrawingPins;
    }, [currentDrawingPins])

    // Handle map clicks for drawing
    useEffect(() => {
        if (!prevIsDrawingMode || !isDrawingMode || !clickEvent?.ground) return;

        const newPin = [clickEvent.ground.longitude, clickEvent.ground.latitude];
        const newPins = [...currentDrawingPinsTracker.current, newPin];

        // Check if we're closing the shape (clicked near the first pin)
        if (newPins.length > 2) {
            const firstPin = newPins[0];
            const distance = Math.sqrt(
                Math.pow(newPin[0] - firstPin[0], 2) + 
                Math.pow(newPin[1] - firstPin[1], 2)
            );
            
            // Close shape if clicked within ~50 meters of first pin (approximate)
            if (distance < 0.0005) {
                completeShape(newPins);
                return;
            }
        }

        setCurrentDrawingPins(newPins);
        updateDrawingVisuals(newPins);
    }, [clickEvent, isDrawingMode, prevIsDrawingMode]);

    const updateDrawingVisuals = (pins) => {
        if (!mapInstance) return;

        // Update pins
        const pinFeatures = pins.map((pin, index) => ({
            type: 'Feature',
            properties: { index },
            geometry: {
                type: 'Point',
                coordinates: pin
            }
        }));

        mapInstance.getSource('drawing-pins').setData({
            type: 'FeatureCollection',
            features: pinFeatures
        });

        // Update lines
        if (pins.length > 1) {
            const lineFeature = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: pins
                }
            };

            mapInstance.getSource('drawing-lines').setData({
                type: 'FeatureCollection',
                features: [lineFeature]
            });
        }
    };

    const completeShape = (pins) => {
        if (pins.length < 3) return;

        // Close the polygon
        const closedCoordinates = [...pins, pins[0]];
        
        // Update the current site's coordinates
        const updatedSite = {
            ...currentSite,
            coordinates: [closedCoordinates], // GeoJSON Polygon format
            // isDraft: false // Mark as no longer draft
        };

        // Update XState context
        const currentData = currentState.context?.data || {};
        const currentSites = currentData.site || [];
        const updatedSites = currentSites.map(s => 
            s.siteId === siteId ? updatedSite : s
        );
        const updatedData = {
            ...currentData,
            site: updatedSites
        };

        // Clear cached perimeter BEFORE updating to prevent restoration
        setCachedPerimeter(null);

        // Send event to update XState context with new data
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });

        // Update the map layer with new coordinates
        if (mapInstance && currentState.context?.namedPaths) {
            const namedPath = currentState.context.namedPaths[0];
            
            // Remove old feature and add updated one
            const sourceId = 'site-features';
            const existingSource = mapInstance.getSource(sourceId);
            if (existingSource) {
                const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };
                const updatedFeatures = currentData.features.map(feature => {
                    if (feature.properties.siteId === siteId) {
                        return {
                            ...feature,
                            geometry: {
                                type: 'Polygon',
                                coordinates: [closedCoordinates]
                            },
                            properties: {
                                ...feature.properties,
                                isDraft: false
                            }
                        };
                    }
                    return feature;
                });
                
                existingSource.setData({
                    type: 'FeatureCollection',
                    features: updatedFeatures
                });
                
                mapInstance.triggerRepaint();
            }
        }
        
        // Reset drawing state
        resetDrawingState();

        console.log('Site perimeter completed and coordinates updated:', updatedSite);
    };

    const resetDrawingState = () => {
        setCurrentDrawingPins([]);
        setIsDrawingMode(false);
        
        // Clear drawing visuals
        if (mapInstance) {
            mapInstance.getSource('drawing-pins').setData({
                type: 'FeatureCollection',
                features: []
            });
            mapInstance.getSource('drawing-lines').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
    };

    const startDrawingMode = () => {
        // Cache the current perimeter before starting drawing
        if (currentSite?.coordinates) {
            setCachedPerimeter(currentSite.coordinates);
        }
        
        // Start with empty drawing pins array
        setCurrentDrawingPins([]);
        setIsDrawingMode(true);
    };

    const cancelDrawingMode = () => {
        // Restore cached perimeter if drawing is cancelled
        if (cachedPerimeter && mapInstance && currentState.context?.namedPaths) {
            const currentData = currentState.context?.data || {};
            const currentSites = currentData.site || [];
            const restoredSites = currentSites.map(s => 
                s.siteId === siteId ? { ...s, coordinates: cachedPerimeter } : s
            );
            const restoredData = {
                ...currentData,
                site: restoredSites
            };

            // Update XState context with restored data
            send({
                type: 'UPDATE_DATA',
                data: restoredData
            });
            setCurrentDrawingPins([]);

            // Update the map layer with restored coordinates
            const sourceId = 'site-features';
            const existingSource = mapInstance.getSource(sourceId);
            if (existingSource) {
                const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };
                const restoredFeatures = currentData.features.map(feature => {
                    if (feature.properties.siteId === siteId) {
                        return {
                            ...feature,
                            geometry: {
                                type: 'Polygon',
                                coordinates: cachedPerimeter
                            }
                        };
                    }
                    return feature;
                });
                
                existingSource.setData({
                    type: 'FeatureCollection',
                    features: restoredFeatures
                });
                
                mapInstance.triggerRepaint();
            }
        }
        
        // Clear cached perimeter
        setCachedPerimeter(null);
        
        // Reset drawing state
        resetDrawingState();
    };

    const toggleDrawingMode = () => {
        if (isDrawingMode) {
            cancelDrawingMode();
        } else {
            startDrawingMode();
        }
    };

    const debouncedHandleSiteChange = useDebounce(handleSiteChange, 700)

    return (
        <div>
            <Typography variant="h6">Site: {plantName}</Typography>
            <Typography variant="body2">Buildings: {buildings.length}</Typography>
            
            {isDraftSite && (
                <>
                    <Box sx={{ my: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Site Details
                        </Typography>
                        <InfoComponent
                            entity={currentSite}
                            handleChange={debouncedHandleSiteChange}
                            type={siteEditingConfig}
                            entityType="Site"
                            originalEntity={currentSite}
                        />
                    </Box>
                    
                    <Button 
                        variant="contained" 
                        style={{backgroundColor: "#CC3289"}}
                        onClick={toggleDrawingMode}
                        sx={{ mb: 2 }}
                        fullWidth
                    >
                        {isDrawingMode ? 'Cancel Drawing' : 'Draw Site Perimeter'}
                    </Button>
                    
                    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                        <Button 
                            variant="contained" 
                            style={{backgroundColor: "#CC3289"}}
                            onClick={handleSubmitSite}
                            sx={{ flex: 1 }}
                            disabled={isDrawingMode}
                        >
                            Submit Site
                        </Button>
                        <Button 
                            variant="outlined" 
                            color="error"
                            onClick={handleCancelSite}
                            sx={{ flex: 1 }}
                            disabled={isDrawingMode}
                        >
                            Cancel Site
                        </Button>
                    </Box>
                </>
            )}
            
            <Divider sx={{ my: 2 }} />
            {buildings.map((unit, i) => (
                <Typography key={i} variant="body2">
                    {unit.name}
                </Typography>
            ))}
        </div>
    );
}

