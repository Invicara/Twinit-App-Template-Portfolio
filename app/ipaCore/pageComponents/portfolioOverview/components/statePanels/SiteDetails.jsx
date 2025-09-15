import React, { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { Typography, Divider, Button, Box, Grid, Card, CardMedia, CardContent } from '@mui/material';
import CustomButton from '../../../../components/atoms/CustomButton';
import { useDispatch, useSelector } from 'react-redux';
import { getClickEvent, getMapTypes, setMapTypes, getMapGraphicReferences, setSelectedGraphicReference, getSelectedGraphicReference } from '../../../../redux/pageComponentState';
import { MapMachineContext, MapContext } from '../../PortfolioOverview';
import { addFeatureToMapLayer, removeFeatureFromMapLayer } from '../../../../../client/scripts/mapEntryActions.mjs';
import { ScriptCache, usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import { InfoComponent } from '../../../../components/InfoComponent/InfoComponent';
import { setDraftType, setIsSelectingPosition, setSelectedCoordinate } from '../../../../redux/siteSetup';
import { IafItemSvc } from '@dtplatform/platform-api';
import {useSelector as useXstateSelector} from "@xstate/react";
import _ from 'lodash';
import { Add, Dashboard, Cancel } from '@material-ui/icons';
import { getActiveLevels, getCachedFile } from '../../../../../services/utils';

export const defaultNewSiteId = "<newSite>";
export const defaultNewBuildingId = "<newBuilding>";


const BuildingThumbnails = ({mapGraphicReferences, handleCancelNewBuildingMode}) => {
    const dispatch = useDispatch();

    const [thumbnailUrls, setThumbnailUrls] = useState({});
    const selectedGraphicReferece = useSelector(getSelectedGraphicReference);

    useEffect(() => {
        return () => {
            dispatch(setDraftType());
            dispatch(setIsSelectingPosition(false));
            dispatch(setSelectedGraphicReference());
        }
    }, [])

    // Handle thumbnail click for building selection
    const handleThumbnailClick = (graphicReference) => {
        if(selectedGraphicReferece !== graphicReference){
            dispatch(setDraftType("building"));
            dispatch(setIsSelectingPosition(true));
            dispatch(setSelectedGraphicReference(graphicReference));
        } else {
            dispatch(setDraftType());
            dispatch(setIsSelectingPosition(false));
            dispatch(setSelectedGraphicReference());
        }
    };


    useEffect(() => {
        const loadThumbnails = async () => {
            const urls = {};
            for (const ref of mapGraphicReferences) {
                if (ref.thumbnail) {
                    try {
                        const url = await getCachedFile(ref.thumbnail);
                        if (url) {
                            urls[ref.thumbnail] = url;
                        }
                    } catch (error) {
                        console.error(`Failed to load thumbnail for ${ref.thumbnail}:`, error);
                    }
                }
            }
            setThumbnailUrls(urls);
        };

        if (mapGraphicReferences && mapGraphicReferences.length > 0) {
            loadThumbnails();
        }
    }, [mapGraphicReferences]);

    return (
        <Box sx={{ mt: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: 16 }}>
                    Select Building Type
                </Typography>
                <CustomButton
                    variant="outlined"
                    color="secondary"
                    onClick={handleCancelNewBuildingMode}
                    size="small"
                    startIcon={<Cancel />}
                >
                    Cancel
                </CustomButton>
            </div>

            {mapGraphicReferences.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                    No building types available
                </Typography>
            ) : (
                <Grid container spacing={2}>
                    {mapGraphicReferences.map((ref, index) => (
                        <Grid item xs={6} sm={4} md={3} key={index}>
                            <Card
                                style={{
                                    cursor: 'pointer',
                                    backgroundColor: ref === selectedGraphicReferece ? 'rgba(223, 21, 140, 0.1)' : 'transparent',
                                    border: ref === selectedGraphicReferece ? '2px solid #DF158C' : '2px solid transparent',
                                    '&:hover': {
                                        transform: ref === selectedGraphicReferece ? 'scale(1.02) translateY(-2px)' : 'translateY(-2px)',
                                        boxShadow: ref === selectedGraphicReferece ? '0 6px 16px rgba(223, 21, 140, 0.4)' : '0 4px 8px rgba(0,0,0,0.15)'
                                    }
                                }}
                                onClick={() => handleThumbnailClick(ref)}
                            >
                                {ref.thumbnail && thumbnailUrls[ref.thumbnail] ? (
                                    <CardMedia
                                        component="img"
                                        height="80"
                                        image={thumbnailUrls[ref.thumbnail]}
                                        alt={ref.name || 'Building thumbnail'}
                                        sx={{ objectFit: 'cover' }}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            height: 80,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#f5f5f5'
                                        }}
                                    >
                                        <Dashboard sx={{ fontSize: 32, color: '#ccc' }} />
                                    </Box>
                                )}
                                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                    <Typography variant="caption" display="block" sx={{ textAlign: 'center', fontSize: '0.75rem' }}>
                                        {ref.name || `Building ${index + 1}`}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
};

export default function SiteDetails({ context }) {
    const {data = [], siteId} = context;
    const {site = [], building = []} = data;
    const buildings = building.filter(d => d.siteId == siteId);
    const currentSite = site.find(s => s.siteId === siteId);
    const plantName = siteId;

    // Get contexts and state
    const { send, actor } = useContext(MapMachineContext);
    const currentState = useXstateSelector(actor, state => state);
    const { mapInstance } = useContext(MapContext);
    const dispatch = useDispatch();
    const clickEvent = useSelector(getClickEvent);
    const mapGraphicReferences = useSelector(getMapGraphicReferences);

    const namedPath = currentState.context.namedPaths[0];

    const levels = getActiveLevels(currentState);

    const types = useSelector(getMapTypes);
    const entityType = levels.slice(-1)[0]?.state
    const type = (types || {})[entityType];

    // Drawing state
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [currentDrawingPins, setCurrentDrawingPins] = useState([]);
    const currentDrawingPinsTracker = useRef(currentDrawingPins);

    // Cache for original perimeter when entering drawing mode
    const [cachedPerimeter, setCachedPerimeter] = useState(null);

    // Cache for original site when entering editing mode
    const [cachedOriginalSite, setCachedOriginalSite] = useState(null);

    // Check if this site is a draft that needs perimeter drawing
    const isDraftSite = currentSite?.isDraft === true;

    // Check if this site is being edited
    const isEditingSite = currentSite?.isEditing === true;

    // New building placement state
    const [isNewBuildingMode, setIsNewBuildingMode] = useState(false);

    // Site is in edit mode if it's either draft or being edited
    const isInEditMode = isDraftSite || isEditingSite;

    const prevIsDrawingMode = usePrevious(isDrawingMode);

    useEffect(() => {
        if(!currentSite?.isDraft && !currentSite?.isEditing){
            // Cache the original site before editing
            setCachedOriginalSite(_.cloneDeep(currentSite));
        }
    }, [currentSite])

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

            const removeSuccess = removeFeatureFromMapLayer({
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
    const handleSubmitSite = async () => {
        if (!currentSite || currentSite.siteId === defaultNewSiteId || !mapInstance || !currentState.context?.namedPaths) return;

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

        //item service creation side effect
        const coll = (await IafItemSvc.getNamedUserItems({query: {_shortName: "geo_sites_coll"}}))._list[0];
        const result = await IafItemSvc.createRelatedItems(coll._userItemId, [finalizedSite]);

        console.log('Site submitted and finalized:', {finalizedSite, result});
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

    const setSiteForEdition = () => {

        const updatedData = _.cloneDeep(currentState.context?.data || {});
        const currentSites = updatedData.site || [];
        const siteToEdit = currentSites.find(s => s.siteId === siteId);
        siteToEdit.isEditing = true;

        // Send event to update XState context
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });
    };

    // Handle canceling edit mode
    const handleCancelEdit = () => {
        if (!cachedOriginalSite) return;

        // Restore the original site data
        const currentData = currentState.context?.data || {};
        const currentSites = currentData.site || [];
        const restoredSites = currentSites.map(s =>
            s.siteId === siteId ? cachedOriginalSite : s
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

        // Update map layer if needed
        if (mapInstance && currentState.context?.namedPaths) {
            const namedPath = currentState.context.namedPaths[0];

            // Remove current feature and add restored one
            removeFeatureFromMapLayer({
                map: mapInstance,
                levelState: 'site',
                featureId: currentSite.siteId,
                idKey: 'siteId',
                namedPath: namedPath
            });

            addFeatureToMapLayer({
                map: mapInstance,
                levelState: 'site',
                feature: {
                    properties: cachedOriginalSite,
                    geometry: cachedOriginalSite.coordinates ? {
                        type: 'Polygon',
                        coordinates: cachedOriginalSite.coordinates
                    } : null,
                    coordinates: cachedOriginalSite.coordinates
                },
                namedPath: namedPath
            });
        }

        console.log('Edit cancelled, site restored:', { original: cachedOriginalSite, siteId });
    };

    // Handle saving edit mode
    const handleSaveEdit = async () => {
        if (!currentSite || !cachedOriginalSite) return;

        // Check if there were any changes
        const hasChanges = !_.isEqual(
            _.omit(currentSite, ['isEditing']),
            _.omit(cachedOriginalSite, ['isEditing'])
        );

        // Finalize the edited site (remove isEditing flag)
        const finalizedSite = { ...currentSite };
        delete finalizedSite.isEditing;

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

        // If there were changes, update the backend
        if (hasChanges) {
            try {
                const coll = (await IafItemSvc.getNamedUserItems({query: {_shortName: "geo_sites_coll"}}))._list[0];
                const result = await IafItemSvc.updateRelatedItems(coll._userItemId, [finalizedSite]);
                console.log('Site updated successfully:', {finalizedSite, result});
            } catch (error) {
                console.error('Error updating site:', error);
            }
        } else {
            console.log('No changes detected, skipping backend update');
        }

        console.log('Site edit completed:', { finalizedSite, hasChanges });
    };

    // Handle starting new building placement mode
    const handleStartNewBuildingMode = () => {
        setIsNewBuildingMode(true);
        console.log('Started new building placement mode');
    };

    // Handle canceling new building placement mode
    const handleCancelNewBuildingMode = () => {
        setIsNewBuildingMode(false);
        console.log('Cancelled new building placement mode');
    };

    // Handle type modifications from InfoComponent
    const handleTypeModification = async (updatedType, changeInfo) => {
        // if (!currentSite) return;
        // const { action, fieldName, oldFieldName, newFieldName, value } = changeInfo;

        dispatch(setMapTypes({...types, [entityType]: updatedType}));
        await ScriptCache.runScript("updateMapType", {updatedType});
    };

    // Handle adding new site info field
    const handleAddSiteInfo = () => {

        // Generate a unique field name
        const newFieldName = `newField${Date.now()}`;

        // Create updated type schema with the new property
        const updatedType = {
            ...type,
            properties: {
                ...type.properties,
                [newFieldName]: {
                    type: 'string',
                    title: 'New Field',
                    description: 'Custom site field',
                    propertyOrder: Object.keys(type.properties).length + 1
                }
            }
        };

        dispatch(setMapTypes({...types, [entityType]: updatedType}));

        // Update the type (this would normally go through a type management system)
        // For now, we'll trigger a re-render by updating the types
        console.log('New field added to site:', { fieldName: newFieldName, updatedSite, updatedType });
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
                    'circle-color': '#DF158C',
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
                    'line-color': '#DF158C',
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

            // Close shape if clicked within ~25 meters of first pin (approximate)
            if (distance < 0.00025) {
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
        send({ type: "END_DRAFT" });

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
        send({ type: "START_DRAFT" });
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

            send({ type: "END_DRAFT" });

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

    return (
        <Box p={2}>
            <Typography variant="h6">Site: {plantName}</Typography>

            {/* Site Info - Always displayed */}
            <Box sx={{ my: 2 }} style={{marginTop: 30}}>
                <div style={{display: "flex", marginBottom: 30, justifyContent: "space-between", alignItems: "center"}}>
                    <div style={{display: "flex", alignItems: "center", gap: 8}}>

                        <img style={{width: 30, height: 30}} src='/icons/file-info.svg'/>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }} style={{fontSize: 18}}>
                            Site Info
                        </Typography>
                    </div>
                    {!isInEditMode && (
                        <CustomButton
                            variant="contained"
                            color="primary"
                            onClick={setSiteForEdition}
                            size="small"
                            disabled={isDrawingMode}
                        >
                            Edit Site
                        </CustomButton>
                    )}
                </div>
                <InfoComponent
                    entity={currentSite}
                    handleChange={handleSiteChange}
                    type={type}
                    entityType={entityType}
                    originalEntity={cachedOriginalSite}
                    disabled={!isInEditMode}
                    modifyTypeCallback={handleTypeModification}
                />
                <Divider style={{ margin: '16px 0'}} />
                    <Box style={{ marginTop: 12, display: 'flex', justifyContent: "right", gap: 14}}>
                        <CustomButton
                            variant="outlined"
                            color="primary"
                            onClick={handleAddSiteInfo}
                            style={{ color: !isInEditMode ? "grey" : "#DF158C", fontWeight: 500, border: "none", backgroundColor: "transparent", padding: 3, boxShadow: "none" }}
                            startIcon={<Add/>}
                            disabled={!isInEditMode}
                        >
                            Add Site Info
                        </CustomButton>
                        <CustomButton
                            variant="contained"
                            color="primary"
                            onClick={handleStartNewBuildingMode}
                            style={{ color: !isInEditMode ? "grey" : "#DF158C", fontWeight: 500, border: "none", backgroundColor: "transparent", padding: 3, boxShadow: "none" }}
                            startIcon={<Dashboard/>}
                            disabled={!isInEditMode}
                        >
                            Add Structure
                        </CustomButton>
                    </Box>
            </Box>

            {isInEditMode && (
                <div style={{display: "flex", flexDirection: "column", justifyContent: "space-between", marginTop: 25, gap: 25}}>
                    <div>
                        <CustomButton
                            variant="contained"
                            color="primary"
                            onClick={toggleDrawingMode}
                            style={{ marginBottom: 16 }}
                            fullWidth
                        >
                            {isDrawingMode ? 'Cancel Drawing' : 'Draw Site Perimeter'}
                        </CustomButton>
                    </div>

                    <Box style={{ marginTop: 24, display: 'flex', gap: 16 }}>
                        <CustomButton
                            variant="outlined"
                            color="secondary"
                            onClick={isDraftSite ? handleCancelSite : handleCancelEdit}
                            style={{ flex: 1 }}
                            disabled={isDrawingMode}
                        >
                            Cancel
                        </CustomButton>
                        <CustomButton
                            variant="contained"
                            color="primary"
                            onClick={isDraftSite ? handleSubmitSite : handleSaveEdit}
                            style={{ flex: 1 }}
                            disabled={isDrawingMode}
                        >
                            Save
                        </CustomButton>
                    </Box>
                </div>
            )}

            <Divider style={{ margin: '16px 0px', marginTop: 25}} />

            {isNewBuildingMode ? (
                <BuildingThumbnails {...{mapGraphicReferences, handleCancelNewBuildingMode}} />
            ) : (
                <>
                    <Typography variant="body2">Buildings: {buildings.length}</Typography>
                    {buildings.map((unit, i) => (
                        <Typography key={i} variant="body2">
                            {unit.name}
                        </Typography>
                    ))}
                </>
            )}
        </Box>
    );
}

