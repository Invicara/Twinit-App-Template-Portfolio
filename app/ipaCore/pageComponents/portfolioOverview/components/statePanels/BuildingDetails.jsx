import React, { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { Typography, Divider, Button, Box, Grid, Card, CardMedia, CardContent } from '@material-ui/core';
import CustomButton from '../../../../components/atoms/CustomButton';
import { useDispatch, useSelector } from 'react-redux';
import { getClickEvent, getMapTypes, setMapTypes } from '../../../../redux/pageComponentState';
import { MapMachineContext, MapContext } from '../../PortfolioOverview';
import { addFeatureToMapLayer, removeFeatureFromMapLayer, removeBuildingFromMap } from '../../../../../client/scripts/mapEntryActions.mjs';
import { ScriptCache, usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import { InfoComponent } from '../../../../components/InfoComponent/InfoComponent';
import { IafItemSvc } from '@dtplatform/platform-api';
import { useSelector as useXstateSelector } from "@xstate/react";
import _ from 'lodash';
import { Add } from '@material-ui/icons';
import { getActiveLevels } from '../../../../../services/utils';
import { ModelContext } from '../../../../contexts/ModelContext';
import { defaultNewBuildingId } from './SiteDetails';

export default function BuildingDetails({ context }) {
    const { data = [], siteId, buildingId } = context;
    const { building: buildings = [] } = data;
    const currentBuilding = buildings.find(b => b.buildingId == buildingId);

    // Get contexts and state
    const { send, actor } = useContext(MapMachineContext);
    const currentState = useXstateSelector(actor, state => state);
    const { mapInstance } = useContext(MapContext);
    const dispatch = useDispatch();
    const clickEvent = useSelector(getClickEvent);

    const namedPath = currentState.context.namedPaths[0];
    const levels = getActiveLevels(currentState);
    const types = useSelector(getMapTypes);
    const entityType = levels.slice(-1)[0]?.state;
    const type = (types || {})[entityType];

    // Cache for original building when entering editing mode
    const [cachedOriginalBuilding, setCachedOriginalBuilding] = useState(null);

    // Check if this site is a draft that needs perimeter drawing
    const isDraftBuilding = currentBuilding?.isDraft === true;
    
    // Check if this site is being edited
    const isEditingSite = currentBuilding?.isEditing === true;
        
    // Building is in edit mode if it's either draft or being edited
    const isInEditMode = isDraftBuilding || isEditingSite;
    

    // Get ModelContext
    const { availableModelComposites, setSelectedModelComposite, selectedModelComposite } = useContext(ModelContext);

    useEffect(() => {
        if(!currentBuilding?.isDraft && !currentBuilding?.isEditing){
            // Cache the original site before editing
            setCachedOriginalBuilding(_.cloneDeep(currentBuilding));
        }
    }, [currentBuilding])

    if (!currentBuilding) return <Typography>No data found.</Typography>;

    const handleSelectModel = () => {
        // Example modelElementId - you can modify this based on your needs
        const modelElementId = currentBuilding.ModelName;

        // Send event to xState machine to set modelElementId - include siteId as specified
        if (send) {
            send({
                type: 'GO_TO',
                siteId,
                buildingId,
                modelElementId
            });
        }

        // Find and set the model composite based on building's ModelName
        if (availableModelComposites && currentBuilding.ModelName) {
            const matchingModel = availableModelComposites.find(
                model => model._name === currentBuilding.ModelName ||
                        model._name.includes(currentBuilding.ModelName) ||
                        currentBuilding.ModelName.includes(model._name)
            );

            if (matchingModel && setSelectedModelComposite) {
                console.log('Setting selected model composite:', matchingModel);
                setSelectedModelComposite(matchingModel);
            } else {
                console.log('No matching model found for:', currentBuilding.ModelName);
                console.log('Available models:', availableModelComposites.map(m => m._name));
            }
        }
    };

    // Handle building property changes
    const handleBuildingChange = (newValue, propertyName, metadata) => {
        if (!currentBuilding) return;

        // Store the old buildingId for comparison
        const oldBuildingId = currentBuilding.buildingId;

        // Update the building object
        const updatedBuilding = {
            ...currentBuilding,
            [propertyName]: newValue
        };

        // Update XState context - operate on building data instead of site
        const currentData = currentState.context?.data || {};
        const currentBuildings = currentData.building || [];
        const updatedBuildings = currentBuildings.map(b =>
            b.buildingId === buildingId ? updatedBuilding : b
        );
        const updatedData = {
            ...currentData,
            building: updatedBuildings
        };

        // Send event to update XState context with new data
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });

        // If buildingId was changed, navigate to the new buildingId to maintain selection
        if (propertyName === 'buildingId' && newValue !== oldBuildingId && newValue.length) {
            console.log('BuildingId changed, navigating to new building:', { oldBuildingId, newBuildingId: newValue });

            // Send GO_TO action to navigate to the updated buildingId - include siteId
            send({
                type: 'GO_TO',
                siteId,
                buildingId: newValue
            });

            const removeSuccess = removeFeatureFromMapLayer({
                map: mapInstance,
                levelState: 'building',
                featureId: oldBuildingId,
                idKey: 'buildingId', // explicitly specify the key for building identification
                namedPath: namedPath
            });

            const addSuccess = addFeatureToMapLayer({
                map: mapInstance,
                levelState: 'building',
                feature: {
                    properties: updatedBuilding,
                    geometry: updatedBuilding.coordinates ? {
                        type: 'Point',
                        coordinates: [updatedBuilding.longitude, updatedBuilding.latitude]
                    } : null,
                    coordinates: [updatedBuilding.longitude, updatedBuilding.latitude] // fallback for coordinate extraction
                },
                namedPath: namedPath
            });
        }

        console.log('Building property updated:', { propertyName, newValue, updatedBuilding });
    };

    const setBuildingForEdition = () => {
        
        const updatedData = _.cloneDeep(currentState.context?.data || {});
        const currentBuildings = updatedData.building || [];
        const buildingToEdit = currentBuildings.find(b => b.buildingId === buildingId);
        buildingToEdit.isEditing = true;

        // Send event to update XState context
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });
    };
    
    // Handle canceling edit mode
    const handleCancelEdit = () => {
        
        // Check if the building is a draft - if so, remove it from the map entirely
        if (currentBuilding?.isDraft) {
            const namedPath = currentState.context.namedPaths[0];

            console.log('Canceling draft building, removing from map:', {mapInstance, buildingId, namedPath});
            
            // Remove the draft building from the map using removeBuildingFromMap
            if (mapInstance && namedPath) {
                removeBuildingFromMap({
                    map: mapInstance,
                    buildingId: buildingId,
                    namedPath: namedPath
                });
            }
            
            // Remove the draft building from the data entirely
            const currentData = currentState.context?.data || {};
            const currentBuildings = currentData.building || [];
            const filteredBuildings = currentBuildings.filter(b => b.buildingId !== buildingId);
            const updatedData = {
                ...currentData,
                building: filteredBuildings
            };
                        
            // Update XState context with filtered data
            send({
                type: 'UPDATE_DATA',
                data: updatedData
            });
            
            // Navigate back to site level since the building no longer exists
            send({
                type: 'GO_TO',
                siteId,
                buildingId: null
            });
            
            console.log('Draft building cancelled and removed:', { buildingId, siteId });
            return;
        }

        if (!cachedOriginalBuilding) return;
        
        // For non-draft buildings, restore the original building data
        const currentData = currentState.context?.data || {};
        const currentBuildings = currentData.building || [];
        const restoredBuildings = currentBuildings.map(b => 
            b.buildingId === buildingId ? cachedOriginalBuilding : b
        );
        const restoredData = {
            ...currentData,
            building: restoredBuildings
        };
        
        // Update XState context with restored data
        send({
            type: 'UPDATE_DATA',
            data: restoredData
        });
        
        console.log('Edit cancelled, building restored:', { original: cachedOriginalBuilding, buildingId });
    };

    // Handle site submission (finalize draft)
    const handleSubmitBuilding = async () => {
        if (!currentBuilding || currentBuilding.siteId === defaultNewBuildingId || !mapInstance || !currentState.context?.namedPaths) return;

        // Step 2: Update the site to mark it as no longer draft
        const finalizedSite = { ...currentBuilding };
        delete finalizedSite.isDraft;

        // Update XState context
        const currentData = currentState.context?.data || {};
        const currentBuildings = currentData.building || [];
        const updatedBuildings = currentBuildings.map(s =>
            s.buildingId === buildingId ? finalizedSite : s
        );
        const updatedData = {
            ...currentData,
            building: updatedBuildings
        };

        // Send event to update XState context with finalized site
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });

        // Step 4: Pre-select the new site with a GO_TO operation
        send({
            type: 'GO_TO',
            siteId: finalizedSite.siteId,
            buildingId: finalizedSite.buildingId
        });

        //item service creation side effect
        const coll = (await IafItemSvc.getNamedUserItems({query: {_shortName: "building_coll"}}))._list[0];
        const result = await IafItemSvc.createRelatedItems(coll._userItemId, [finalizedSite]);

        console.log('Site submitted and finalized:', {finalizedSite, result});
    };
    
    // Handle saving edit mode
    const handleSaveEdit = async () => {
        if (!currentBuilding || !cachedOriginalBuilding) return;
        
        // Check if there were any changes
        const hasChanges = !_.isEqual(
            _.omit(currentBuilding, ['isEditing']), 
            _.omit(cachedOriginalBuilding, ['isEditing'])
        );
        
        // Finalize the edited building (remove isEditing flag)
        const finalizedBuilding = { ...currentBuilding };
        delete finalizedBuilding.isEditing;
        
        // Update XState context
        const currentData = currentState.context?.data || {};
        const currentBuildings = currentData.building || [];
        const updatedBuildings = currentBuildings.map(b => 
            b.buildingId === buildingId ? finalizedBuilding : b
        );
        const updatedData = {
            ...currentData,
            building: updatedBuildings
        };
                
        // Send event to update XState context with finalized building
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });
        
        // If there were changes, update the backend
        if (hasChanges) {
            try {
                const coll = (await IafItemSvc.getNamedUserItems({query: {_shortName: "building_coll"}}))._list[0];
                const result = await IafItemSvc.updateRelatedItems(coll._userItemId, [finalizedBuilding]);
                console.log('Building updated successfully:', {finalizedBuilding, result});
            } catch (error) {
                console.error('Error updating building:', error);
            }
        } else {
            console.log('No changes detected, skipping backend update');
        }
        
        console.log('Building edit completed:', { finalizedBuilding, hasChanges });
    };

    // Handle type modifications from InfoComponent
    const handleTypeModification = async (updatedType, changeInfo) => {
        dispatch(setMapTypes({...types, [entityType]: updatedType}));
        await ScriptCache.runScript("updateMapType", {updatedType});
    };

    // Handle adding new building info field
    const handleAddBuildingInfo = () => {
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
                    description: 'Custom building field',
                    propertyOrder: Object.keys(type.properties).length + 1
                }
            }
        };

        dispatch(setMapTypes({...types, [entityType]: updatedType}));
        
        // Update the type (this would normally go through a type management system)
        console.log('New field added to building:', { fieldName: newFieldName, updatedType });
    };

    return (
        <div>
            <Typography variant="h6">Building: {currentBuilding.name}</Typography>
            <Typography variant="body2">Site: {siteId}</Typography>
            <Divider sx={{ my: 2 }} />

            {/* Building Info - Always displayed */}
            <Box sx={{ my: 2 }} style={{marginTop: 30}}>
                <div style={{display: "flex", marginBottom: 30, justifyContent: "space-between", alignItems: "center"}}>
                    <div style={{display: "flex", alignItems: "center", gap: 8}}>
                        <img style={{width: 30, height: 30}} src='/icons/file-info.svg'/>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }} style={{fontSize: 18}}>
                            Building Info
                        </Typography>
                    </div>
                    {!isInEditMode && (
                        <CustomButton 
                            variant="contained" 
                            color="primary"
                            onClick={setBuildingForEdition}
                            size="small"
                        >
                            Edit Building
                        </CustomButton>
                    )}
                </div>
                <InfoComponent
                    entity={currentBuilding}
                    handleChange={handleBuildingChange}
                    type={type}
                    entityType={entityType}
                    originalEntity={cachedOriginalBuilding}
                    disabled={!isInEditMode}
                    modifyTypeCallback={handleTypeModification}
                />
                <Divider style={{ margin: '16px 0'}} />
                <Box style={{ marginTop: 12, display: 'flex', justifyContent: "space-between", gap: 14}}>
                    <Box style={{ display: 'flex', justifyContent: "left", gap: 14}}>
                        <CustomButton 
                            variant="outlined" 
                            color="primary"
                            onClick={handleAddBuildingInfo}
                            style={{ color: !isInEditMode ? "grey" : "#DF158C", fontWeight: 500, border: "none", backgroundColor: "transparent", padding: 3, boxShadow: "none" }}
                            startIcon={<Add/>}
                            disabled={!isInEditMode}
                        >
                            Add Building Info
                        </CustomButton>
                    </Box>
                    <Box>
                        <CustomButton
                            variant="contained"
                            color="primary"
                            onClick={handleSelectModel}
                            disabled={!send}
                            size="small"
                        >
                            Select Model
                        </CustomButton>
                    </Box>
                </Box>
            </Box>
            
            {isInEditMode && (
                <div style={{display: "flex", flexDirection: "column", justifyContent: "space-between", marginTop: 25, gap: 25}}>
                    <Box style={{ marginTop: 24, display: 'flex', gap: 16 }}>
                        <CustomButton
                            variant="outlined"
                            color="secondary"
                            onClick={handleCancelEdit}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </CustomButton>
                        <CustomButton
                            variant="contained"
                            color="primary"
                            onClick={isDraftBuilding ? handleSubmitBuilding : handleSaveEdit}
                            style={{ flex: 1 }}
                        >
                            Save
                        </CustomButton>
                    </Box>
                </div>
            )}
        </div>
    );
}
