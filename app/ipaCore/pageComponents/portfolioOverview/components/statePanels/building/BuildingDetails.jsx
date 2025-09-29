import React, { useContext, useEffect, useState, useMemo } from 'react';
import { Typography, Divider, Box } from '@material-ui/core';
import CustomButton from '../../../../../components/atoms/CustomButton.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { getMapTypes, setMapTypes } from '../../../../../redux/pageComponentState.js';
import { MapMachineContext, MapContext } from '../../../PortfolioOverview.jsx';
import { addFeatureToMapLayer, removeFeatureFromMapLayer, removeMeshElementFromMap } from '../../../../../../client/scripts/mapEntryActions.mjs';
import { ScriptCache } from "@invicara/ipa-core/modules/IpaUtils";
import { InfoComponent } from '../../../../../components/InfoComponent/InfoComponent.jsx';
import { IafItemSvc } from '@dtplatform/platform-api';
import { useSelector as useXstateSelector } from "@xstate/react";
import _ from 'lodash';
import { Add } from '@material-ui/icons';
import { getActiveLevels } from '../../../../../../services/utils.js';

export default function BuildingDetails({ context }) {

    // Get contexts and state
    const { send, actor } = useContext(MapMachineContext);
    const currentState = useXstateSelector(actor, state => state);

    const [levels, currentElementType, namedPath, idKey, entityId, currentEntity, lowerLevelState, higherNamedPath] = useMemo(() => {
        const levels = getActiveLevels(currentState);

        const sPath = levels?.map(el => el.state).join(".");
        const cElementType = sPath?.split(".")?.slice(-1)?.[0];

        const namedPaths = currentState.context.namedPaths[0];

        const namedPath = namedPaths.find(p => p.state === cElementType);
        const { idKey } = namedPath;

        const lowerLevelState = Object.assign({}, ...levels
            .filter(l => l.idKey && l.scopeLevel < namedPath.scopeLevel)
            .map(l => ({[l.idKey]: currentState.context[l.idKey]})
        ));

        const higherNamedPath = namedPaths.find(p => p.scopeLevel === namedPath.scopeLevel - 1);

        const entityId = currentState.context[idKey]
        const currentEntity = currentState.context.data[namedPath.state].find(e => e[idKey] === entityId);

        return [levels, cElementType, namedPath, idKey, entityId, currentEntity, lowerLevelState, higherNamedPath];

    }, [currentState]);

    const { mapInstance } = useContext(MapContext);
    const dispatch = useDispatch();

    const types = useSelector(getMapTypes);
    const type = (types || {})[currentElementType];

    // Cache for original entity when entering editing mode
    const [cachedOriginalEntity, setCachedOriginalEntity] = useState(null);

    // Check if this entity is a draft that needs perimeter drawing
    const isDraftEntity = currentEntity?.isDraft === true;

    // Check if this entity is being edited
    const isEditingEntity = currentEntity?.isEditing === true;

    // Entity is in edit mode if it's either draft or being edited
    const isInEditMode = isDraftEntity || isEditingEntity;


    useEffect(() => {
        if(!currentEntity?.isDraft && !currentEntity?.isEditing){
            // Cache the original entity before editing
            setCachedOriginalEntity(_.cloneDeep(currentEntity));
        }
    }, [currentEntity])

    if (!currentEntity) return <Typography>No data found.</Typography>;

    // Handle entity property changes
    const handleEntityChange = (newValue, propertyName, metadata) => {
        if (!currentEntity) return;

        // Store the old entityId for comparison
        const oldEntityId = currentEntity[idKey];

        // Update the entity object
        const updatedEntity = {
            ...currentEntity,
            [propertyName]: newValue
        };

        // Update XState context - operate on entity data
        const currentData = currentState.context?.data || {};
        const currentEntities = currentData?.[currentElementType] || [];
        const updatedEntities = currentEntities.map(b =>
            b[idKey] === entityId ? updatedEntity : b
        );
        const updatedData = {
            ...currentData,
            [currentElementType]: updatedEntities
        };

        // Send event to update XState context with new data
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });

        // If entityId was changed, navigate to the new entityId to maintain selection
        if (propertyName === idKey && newValue !== oldEntityId && newValue.length) {
            console.log('EntityId changed, navigating to new entity:', { oldEntityId, newEntityId: newValue });

            // Send GO_TO action to navigate to the updated entityId
            send({
                type: 'GO_TO',
                ...lowerLevelState,
                [idKey]: newValue
            });

            const removeSuccess = removeFeatureFromMapLayer({
                map: mapInstance,
                levelState: currentElementType,
                featureId: oldEntityId,
                idKey, // explicitly specify the key for entity identification
                namedPath: namedPath
            });

            const addSuccess = addFeatureToMapLayer({
                map: mapInstance,
                levelState: currentElementType,
                feature: {
                    properties: updatedEntity,
                    geometry: updatedEntity.coordinates ? {
                        type: 'Point',
                        coordinates: [updatedEntity.longitude, updatedEntity.latitude]
                    } : null,
                    coordinates: [updatedEntity.longitude, updatedEntity.latitude] // fallback for coordinate extraction
                },
                namedPath: namedPath
            });
        }

        console.log('Entity property updated:', { propertyName, newValue, updatedEntity });
    };

    const setEntityForEdition = () => {

        const updatedData = _.cloneDeep(currentState.context?.data || {});
        const currentEntities = updatedData[currentElementType] || [];
        const entityToEdit = currentEntities.find(b => b[idKey] === entityId);
        entityToEdit.isEditing = true;

        // Send event to update XState context
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });
    };

    // Handle canceling edit mode
    const handleCancelEdit = () => {

        // Check if the entity is a draft - if so, remove it from the map entirely
        if (currentEntity?.isDraft) {

            console.log('Canceling draft entity, removing from map:', {mapInstance, entityId, namedPath});

            // Remove the draft entity from the map using removeMeshElementFromMap
            if (mapInstance && namedPath) {
                removeMeshElementFromMap({
                    entityType: currentElementType,
                    map: mapInstance,
                    featureId: entityId,
                    namedPath
                });
            }

            // Remove the draft entity from the data entirely
            const currentData = currentState.context?.data || {};
            const currentEntities = currentData[currentElementType] || [];
            const filteredEntities = currentEntities.filter(b => b[idKey] !== entityId);
            const updatedData = {
                ...currentData,
                [currentElementType]: filteredEntities
            };

            // Update XState context with filtered data
            send({
                type: 'UPDATE_DATA',
                data: updatedData
            });

            // Navigate back to site level since the entity no longer exists
            send({
                type: 'GO_TO',
                ...lowerLevelState,
                [idKey]: null
            });

            console.log('Draft entity cancelled and removed:', { entityId });
            return;
        }

        if (!cachedOriginalEntity) return;

        // For non-draft entities, restore the original entity data
        const currentData = currentState.context?.data || {};
        const currentEntities = currentData[currentElementType] || [];
        const restoredEntities = currentEntities.map(b =>
            b[idKey] === entityId ? cachedOriginalEntity : b
        );
        const restoredData = {
            ...currentData,
            [currentElementType]: restoredEntities
        };

        // Update XState context with restored data
        send({
            type: 'UPDATE_DATA',
            data: restoredData
        });

        console.log('Edit cancelled, entity restored:', { original: cachedOriginalEntity, entityId });
    };

    // Handle entity submission (finalize draft)
    const handleSubmitEntity = async () => {
        if (!currentEntity || !mapInstance || !currentState.context?.namedPaths) return;

        // Step 2: Update the entity to mark it as no longer draft
        const finalizedEntity = { ...currentEntity };
        delete finalizedEntity.isDraft;

        // Update XState context
        const currentData = currentState.context?.data || {};
        const currentEntities = currentData[currentElementType] || [];
        const updatedEntities = currentEntities.map(s =>
            s[idKey] === entityId ? finalizedEntity : s
        );
        const updatedData = {
            ...currentData,
            [currentElementType]: updatedEntities
        };

        // Send event to update XState context with finalized entity
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });
        
        // Step 4: Pre-select the new entity with a GO_TO operation
        send({
            type: 'GO_TO',
            ...lowerLevelState,
            [idKey]: finalizedEntity[idKey]
        });

        //item service creation side effect
        const coll = (await IafItemSvc.getNamedUserItems({query: {_shortName: namedPath.collShortName}}))._list[0];
        const result = await IafItemSvc.createRelatedItems(coll._userItemId, [finalizedEntity]);

        console.log('Entity submitted and finalized:', {finalizedEntity, result});
    };

    // Handle saving edit mode
    const handleSaveEdit = async () => {
        if (!currentEntity || !cachedOriginalEntity) return;

        // Check if there were any changes
        const hasChanges = !_.isEqual(
            _.omit(currentEntity, ['isEditing']),
            _.omit(cachedOriginalEntity, ['isEditing'])
        );

        // Finalize the edited entity (remove isEditing flag)
        const finalizedEntity = { ...currentEntity };
        delete finalizedEntity.isEditing;

        // Update XState context
        const currentData = currentState.context?.data || {};
        const currentEntities = currentData[currentElementType] || [];
        const updatedEntities = currentEntities.map(b =>
            b[idKey] === entityId ? finalizedEntity : b
        );
        const updatedData = {
            ...currentData,
            [currentElementType]: updatedEntities
        };

        // Send event to update XState context with finalized entity
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });

        // If there were changes, update the backend
        if (hasChanges) {
            try {
                const coll = (await IafItemSvc.getNamedUserItems({query: {_shortName: namedPath.collShortName}}))._list[0];
                const result = await IafItemSvc.updateRelatedItems(coll._userItemId, [finalizedEntity]);
                console.log('Entity updated successfully:', {finalizedEntity, result});
            } catch (error) {
                console.error('Error updating entity:', error);
            }
        } else {
            console.log('No changes detected, skipping backend update');
        }

        console.log('Entity edit completed:', { finalizedEntity, hasChanges });
    };

    // Handle type modifications from InfoComponent
    const handleTypeModification = async (updatedType, changeInfo) => {
        dispatch(setMapTypes({...types, [currentElementType]: updatedType}));
        await ScriptCache.runScript("updateMapType", {updatedType});
    };

    // Handle adding new entity info field
    const handleAddEntityInfo = () => {
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
                    description: `Custom ${currentElementType} field`,
                    propertyOrder: Object.keys(type.properties).length + 1
                }
            }
        };

        dispatch(setMapTypes({...types, [currentElementType]: updatedType}));

        // Update the type (this would normally go through a type management system)
        console.log(`New field added to ${currentElementType}:`, { fieldName: newFieldName, updatedType });
    };

    return (
        <div>

            {/* Entity Info - Always displayed */}
            <Box p={0} m={0}>
                <Box p={2}>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                        <div style={{display: "flex", alignItems: "center", gap: 8}}>
                            <img style={{width: 30, height: 30}} src='/icons/file-info.svg'/>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }} style={{fontSize: 18}}>
                                {currentEntity.name}
                            </Typography>
                        </div>
                        {!isInEditMode && (
                            <CustomButton
                                variant="contained"
                                color="primary"
                                onClick={setEntityForEdition}
                                size="small"
                            >
                                Edit {namedPath.displayName}
                            </CustomButton>
                        )}
                    </div>
                    {currentState.context?.[higherNamedPath?.idKey] && <Typography variant="body2">{higherNamedPath.displayName}: {currentState.context[higherNamedPath.idKey]}</Typography>}
                    <Divider sx={{ my: 2 }} />
                </Box>
                <Box px={2}>
                    {/* <InfoComponent
                        entity={currentEntity}
                        handleChange={handleEntityChange}
                        type={type}
                        entityType={currentElementType}
                        originalEntity={cachedOriginalEntity}
                        disabled={!isInEditMode}
                        modifyTypeCallback={handleTypeModification}
                        allowReadOnlyOverride={currentEntity?.isDraft}
                    /> */}
                </Box>
                <Box p={2} style={{ marginTop: 12, display: 'flex', justifyContent: "space-between", gap: 14}}>
                    <Box style={{ display: 'flex', justifyContent: "left", gap: 14}}>
                        <CustomButton
                            variant="outlined"
                            color="primary"
                            onClick={handleAddEntityInfo}
                            style={{ color: !isInEditMode ? "grey" : "#DF158C", fontWeight: 500, border: "none", backgroundColor: "transparent", padding: 3, boxShadow: "none" }}
                            startIcon={<Add/>}
                            disabled={!isInEditMode}
                        >
                            Add {namedPath.displayName} Info
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
                            onClick={isDraftEntity ? handleSubmitEntity : handleSaveEdit}
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
