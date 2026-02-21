import React, { useContext, useEffect, useState, useMemo } from 'react';
import { Typography, Divider, Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid } from '@material-ui/core';
import CustomButton from '../../../../../components/atoms/CustomButton.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { getMapTypes, setMapTypes, getMapGraphicReferences, getStructures } from '../../../../../redux/pageComponentState.js';
import { MapMachineContext, MapContext } from '../../../PortfolioOverview.jsx';
import { get3DGraphicsController } from '../../../../../../client/scripts/mapEntryActions.mjs';
import { ScriptCache } from "@invicara/ipa-core/modules/IpaUtils";
import { InfoComponent } from '../../../../../components/InfoComponent/InfoComponent.jsx';
import { IafItemSvc } from '@dtplatform/platform-api';
import { useSelector as useXstateSelector } from "@xstate/react";
import _ from 'lodash';
import { Add, Delete, Edit } from '@material-ui/icons';
import { getActiveLevels } from '../../../../../../services/utils.js';
import BuildingThumbnails from '../BuildingThumbnails';
import { useDebounce } from '../../../../../hooks/useDebounce.js';

export default function BuildingDetails({ context }) {

    // Get contexts and state
    const { send, actor } = useContext(MapMachineContext);
    const currentState = useXstateSelector(actor, state => state);

    const [levels, currentElementType, namedPaths, namedPath, idKey, entityId, currentEntity, lowerLevelState, higherNamedPath, lowerNamedPath] = useMemo(() => {
        const levels = getActiveLevels(currentState);

        const sPath = levels?.map(el => el.state).join(".");
        const cElementType = sPath?.split(".")?.slice(-1)?.[0];

        const namedPaths = currentState.context.namedPaths[0];
        console.log('namedPaths:', namedPaths);

        const namedPath = namedPaths.find(p => p.state === cElementType);
        const { idKey } = namedPath;

        const lowerLevelState = Object.assign({}, ...levels
            .filter(l => l.idKey && l.scopeLevel < namedPath.scopeLevel)
            .map(l => ({[l.idKey]: currentState.context[l.idKey]})
        ));

        const higherNamedPath = namedPaths.find(p => p.scopeLevel === namedPath.scopeLevel - 1);
        const lowerNamedPath = namedPaths.find(p => p.scopeLevel === namedPath.scopeLevel + 1);

        const entityId = currentState.context[idKey]
        const currentEntity = currentState.context.data[namedPath.state].find(e => e[idKey] === entityId);

        return [levels, cElementType, namedPaths, namedPath, idKey, entityId, currentEntity, lowerLevelState, higherNamedPath, lowerNamedPath];

    }, [currentState]);

      const syncBuildingIntoParent = React.useCallback(
        (baseData, modifier) => {
            // Only relevant when we’re editing buildings and we know the parent level
            if (currentElementType !== 'building' || !higherNamedPath) {
                return baseData;
            }

            const parentState = higherNamedPath.state;     // e.g. 'site'
            const parentIdKey = higherNamedPath.idKey;     // e.g. 'siteId'
            const parentId =
                currentEntity?.[parentIdKey] ??
                currentState.context?.[parentIdKey];

            if (!parentId) return baseData;

            const data = _.cloneDeep(baseData);
            const parents = data[parentState] || [];

            data[parentState] = parents.map(parent => {
                if (parent[parentIdKey] !== parentId) return parent;

                const buildings = Array.isArray(parent.buildings)
                    ? parent.buildings
                    : [];

                const updatedBuildings = modifier(buildings);

                return {
                    ...parent,
                    buildings: updatedBuildings
                };
            });

            return data;
        },
        [currentElementType, higherNamedPath, currentEntity, currentState.context, idKey]
    );

    /**
     * If the building's parent site exists in context but has not been saved to the collection yet
     * (no _id), persist the site first. Returns the parent entity (with _id set) for use in
     * _relationships. Caller should merge the returned site _id into their data and send UPDATE_DATA.
     */
    const ensureParentSiteSaved = React.useCallback(async (context, namedPath, entityWithParentId) => {
        if (!namedPath?.parentState || !context?.namedPaths?.[0] || !context?.data) {
            return null;
        }
        const parentPath = context.namedPaths[0].find(el => el.state === namedPath.parentState);
        if (!parentPath) return null;

        const parentId = entityWithParentId?.[parentPath.idKey];
        if (!parentId) return null;

        const parentEntity = (context.data[parentPath.state] || []).find(
            el => el[parentPath.idKey] === parentId
        );
        if (!parentEntity) return null;

        if (parentEntity._id) {
            return parentEntity;
        }

        try {
            const sitePayload = { ...parentEntity };
            delete sitePayload.isDraft;
            const parentColl = (await IafItemSvc.getNamedUserItems({ query: { _shortName: parentPath.collShortName } }))._list[0];
            const result = await IafItemSvc.createRelatedItems(parentColl._userItemId, [sitePayload]);
            const created = Array.isArray(result) ? result[0] : result?._list?.[0] ?? result;
            const createdId = created?._id;
            if (!createdId) {
                console.warn('ensureParentSiteSaved: created site had no _id', result);
                return parentEntity;
            }
            return { ...parentEntity, _id: createdId };
        } catch (err) {
            console.error('Error saving parent site before building:', err);
            return null;
        }
    }, []);

    const { mapInstance } = useContext(MapContext);
    const dispatch = useDispatch();

    const types = useSelector(getMapTypes);
    const type = (types || {})[currentElementType];
    const mapGraphicReferences = useSelector(getMapGraphicReferences);
    const structures = useSelector(getStructures);

    // Cache for original entity when entering editing mode
    const [cachedOriginalEntity, setCachedOriginalEntity] = useState(null);

    // Delete modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    // Positioning mode state
    const [isPositioningMode, setIsPositioningMode] = useState(false);

    const [controller, setController] = useState();

    // Cache for original positioning values when entering positioning mode
    const [cachedPositioning, setCachedPositioning] = useState(null);

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

    // Handle entity property changes
         const handleEntityChange = (newValue, propertyName, metadata) => {
        if (!currentEntity || (propertyName === idKey && newValue === undefined)) return;

        const oldEntityId = currentEntity[idKey];

        // Updated version of the building/entity
        const updatedEntity = {
            ...currentEntity,
            [propertyName]: newValue
        };

        const currentData = currentState.context?.data || {};
        let updatedData = _.cloneDeep(currentData);

        // 1) Update flat collection (e.g. data.building)
        const currentEntities = updatedData[currentElementType] || [];
        updatedData[currentElementType] = currentEntities.map(b =>
            b[idKey] === entityId ? updatedEntity : b
        );

        // 2) Keep site.buildings in sync (important for charts/markers)
        updatedData = syncBuildingIntoParent(updatedData, buildings =>
            buildings.map(b =>
                b[idKey] === entityId ? { ...b, ...updatedEntity } : b
            )
        );

        // Send event to update XState context with new data
        send({
            type: 'UPDATE_DATA',
            data: updatedData
        });

        // If entityId was changed, navigate to the new entityId to maintain selection
        if (['structureName', idKey].includes(propertyName) &&
            newValue !== oldEntityId &&
            newValue?.length
        ) {
            console.log('EntityId changed, navigating to new entity:', { oldEntityId, newEntityId: newValue });

            if (propertyName === idKey) {
                send({
                    type: 'GO_TO',
                    ...lowerLevelState,
                    [idKey]: newValue
                });
            }
        }

        console.log('Entity property updated:', { propertyName, newValue, updatedEntity });
    };

    const handleStructureChange = structure => {
        handleEntityChange(structure.name, "structureName");
    }

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
        //disable clicks
        send({
            type: 'START_DRAFT'
        });
    };

    // Handle canceling edit mode
      const handleCancelEdit = () => {
        // Draft → delete entirely
        if (currentEntity?.isDraft) {
            console.log('Canceling draft entity, removing from map:', { mapInstance, entityId, namedPath });

            const currentData = currentState.context?.data || {};
            let updatedData = _.cloneDeep(currentData);

            // Remove from flat collection
            const currentEntities = updatedData[currentElementType] || [];
            updatedData[currentElementType] = currentEntities.filter(b => b[idKey] !== entityId);

            // Remove from parent site.buildings as well
            updatedData = syncBuildingIntoParent(updatedData, buildings =>
                buildings.filter(b => b[idKey] !== entityId)
            );

            send({ type: 'UPDATE_DATA', data: updatedData });

            send({ type: 'END_DRAFT' });
            send({
                type: 'GO_TO',
                ...lowerLevelState,
                [idKey]: null
            });

            console.log('Draft entity cancelled and removed:', { entityId });
            return;
        }

        if (!cachedOriginalEntity) return;

        setCachedPositioning(null);
        setIsPositioningMode(false);

        const currentData = currentState.context?.data || {};
        let updatedData = _.cloneDeep(currentData);

        // Restore flat collection
        const currentEntities = updatedData[currentElementType] || [];
        updatedData[currentElementType] = currentEntities.map(b =>
            b[idKey] === entityId ? cachedOriginalEntity : b
        );

        // Restore parent site.buildings copy
        updatedData = syncBuildingIntoParent(updatedData, buildings =>
            buildings.map(b =>
                b[idKey] === entityId ? { ...b, ...cachedOriginalEntity } : b
            )
        );

        send({ type: 'UPDATE_DATA', data: updatedData });
        send({ type: 'END_DRAFT' });

        console.log('Edit cancelled, entity restored:', { original: cachedOriginalEntity, entityId });
    };

    // Handle entity submission (finalize draft)
       const handleSubmitEntity = async () => {
        if (!currentEntity || !mapInstance || !currentState.context?.namedPaths) return;

        const finalizedEntity = { ...currentEntity };
        delete finalizedEntity.isDraft;

        const currentData = currentState.context?.data || {};
        let updatedData = _.cloneDeep(currentData);

        // 1) Update flat building collection (add or replace)
        const currentEntities = updatedData[currentElementType] || [];
        const idx = currentEntities.findIndex(s => s[idKey] === entityId);
        if (idx === -1) {
            updatedData[currentElementType] = [...currentEntities, finalizedEntity];
        } else {
            updatedData[currentElementType] = currentEntities.map(s =>
                s[idKey] === entityId ? finalizedEntity : s
            );
        }

        // 2) Ensure parent site.buildings contains the same finalized entity
        updatedData = syncBuildingIntoParent(updatedData, buildings => {
            const bIdx = buildings.findIndex(b => b[idKey] === entityId);
            if (bIdx === -1) {
                return [...buildings, finalizedEntity];
            }
            return buildings.map(b =>
                b[idKey] === entityId ? { ...b, ...finalizedEntity } : b
            );
        });

        // 3) If parent site is new (not in collection), save it first and merge _id into data
        if (namedPath.parentState) {
            const parentEntityForRel = await ensureParentSiteSaved(currentState.context, namedPath, finalizedEntity);
            if (parentEntityForRel?._id) {
                const parentPath = currentState.context.namedPaths[0].find(el => el.state === namedPath.parentState);
                if (parentPath) {
                    const parentId = finalizedEntity[parentPath.idKey];
                    updatedData[parentPath.state] = (updatedData[parentPath.state] || []).map(s =>
                        s[parentPath.idKey] === parentId ? { ...s, _id: parentEntityForRel._id } : s
                    );
                    const parentColl = (await IafItemSvc.getNamedUserItems({ query: { _shortName: parentPath.collShortName } }))._list[0];
                    if (parentColl) {
                        finalizedEntity._relationships = [{
                            _relatedUserItemId: parentColl._userItemId,
                            _relatedToIds: [parentEntityForRel._id]
                        }];
                    }
                }
            }
        }

        setCachedPositioning(null);
        setIsPositioningMode(false);

        send({ type: 'UPDATE_DATA', data: updatedData });

        send({ type: 'END_DRAFT' });
        send({
            type: 'GO_TO',
            ...lowerLevelState,
            [idKey]: finalizedEntity[idKey]
        });

        const coll = (await IafItemSvc.getNamedUserItems({ query: { _shortName: namedPath.collShortName } }))._list[0];
        const result = await IafItemSvc.createRelatedItems(coll._userItemId, [finalizedEntity]);

        console.log('result', result);
        console.log('Entity submitted and finalized:', { finalizedEntity, result });
    };

    // Handle saving edit mode
     const handleSaveEdit = async () => {
        if (!currentEntity || !cachedOriginalEntity) return;

        const hasChanges = !_.isEqual(
            _.omit(currentEntity, ['isEditing']),
            _.omit(cachedOriginalEntity, ['isEditing'])
        );

        const finalizedEntity = { ...currentEntity };
        delete finalizedEntity.isEditing;

        const currentData = currentState.context?.data || {};
        let updatedData = _.cloneDeep(currentData);

        // 1) Update flat collection
        const currentEntities = updatedData[currentElementType] || [];
        updatedData[currentElementType] = currentEntities.map(b =>
            b[idKey] === entityId ? finalizedEntity : b
        );

        // 2) Update parent site.buildings
        updatedData = syncBuildingIntoParent(updatedData, buildings =>
            buildings.map(b =>
                b[idKey] === entityId ? { ...b, ...finalizedEntity } : b
            )
        );

        send({ type: 'UPDATE_DATA', data: updatedData });
        send({ type: 'END_DRAFT' });

        setCachedPositioning(null);
        setIsPositioningMode(false);

        if (hasChanges) {
            try {
                const parentEntityForRel = await ensureParentSiteSaved(currentState.context, namedPath, finalizedEntity);
                if (parentEntityForRel?._id && namedPath.parentState) {
                    const parentPath = currentState.context.namedPaths[0].find(el => el.state === namedPath.parentState);
                    if (parentPath) {
                        const parentId = finalizedEntity[parentPath.idKey];
                        const siteInData = (currentState.context.data[parentPath.state] || []).find(s => s[parentPath.idKey] === parentId);
                        if (siteInData && !siteInData._id) {
                            updatedData[parentPath.state] = (updatedData[parentPath.state] || []).map(s =>
                                s[parentPath.idKey] === parentId ? { ...s, _id: parentEntityForRel._id } : s
                            );
                            send({ type: 'UPDATE_DATA', data: updatedData });
                        }
                    }
                }
                const coll = (await IafItemSvc.getNamedUserItems({ query: { _shortName: namedPath.collShortName } }))._list[0];
                const result = await IafItemSvc.updateRelatedItems(coll._userItemId, [finalizedEntity]);
                console.log('Entity updated successfully:', { finalizedEntity, result });
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
        const props = type.properties || {};
        const maxOrder = Object.values(props).reduce((m, p) =>
            Math.max(m, typeof p?.propertyOrder === 'number' ? p.propertyOrder : -1), -1);

        const updatedType = {
            ...type,
            properties: {
                ...props,
                [newFieldName]: {
                type: 'string',
                title: 'New Field',
                description: `Custom ${currentElementType} field`,
                propertyOrder: maxOrder + 1,
                },
            },
        };

        dispatch(setMapTypes({...types, [currentElementType]: updatedType}));

        // Update the type (this would normally go through a type management system)
        console.log(`New field added to ${currentElementType}:`, { fieldName: newFieldName, updatedType });
    };

    // Handle delete modal
    const handleOpenDeleteModal = () => {
        setDeleteModalOpen(true);
    };

    const handleCloseDeleteModal = () => {
        setDeleteModalOpen(false);
    };

    // Handle entity deletion
    const handleDeleteEntity = async () => {
        if (!currentEntity || !mapInstance || !namedPath) return;

        try {
            console.log('Deleting entity:', { entityId, currentEntity });

            const currentData = currentState.context?.data || {};
            let updatedData = _.cloneDeep(currentData);

            // 1) Remove from flat collection
            const currentEntities = updatedData[currentElementType] || [];
            updatedData[currentElementType] = currentEntities.filter(e => e[idKey] !== entityId);

            // 2) Remove from parent site.buildings
            updatedData = syncBuildingIntoParent(updatedData, buildings =>
                buildings.filter(b => b[idKey] !== entityId)
            );

            send({ type: 'UPDATE_DATA', data: updatedData });

            const coll = (await IafItemSvc.getNamedUserItems({ query: { _shortName: namedPath.collShortName } }))._list[0];
            const result = await IafItemSvc.deleteRelatedItem(coll._userItemId, currentEntity._id);

            console.log('Entity deleted successfully:', { entityId, result });

            send({ type: 'END_DRAFT' });
            send({
                type: 'GO_TO',
                ...lowerLevelState,
                [idKey]: null
            });

            setDeleteModalOpen(false);
        } catch (error) {
            console.error('Error deleting entity:', error);
        }
    };

    // Handle positioning value changes
    const handlePositioningChange = (modification) => {
        const newPosition = _.cloneDeep(modification);
        if (!currentEntity) return;

        for (let k of Object.keys(newPosition)) {
            if (!newPosition[k] || Number.isNaN(newPosition[k])) {
                delete newPosition[k];
            } else {
                newPosition[k] = parseFloat(newPosition[k]);
            }
        }

        const updatedEntity = {
            ...currentEntity,
            ...newPosition
        };

        const currentData = currentState.context?.data || {};
        let updatedData = _.cloneDeep(currentData);

        // 1) Update flat collection
        const currentEntities = updatedData[currentElementType] || [];
        updatedData[currentElementType] = currentEntities.map(b =>
            b[idKey] === entityId ? updatedEntity : b
        );

        // 2) Update parent site.buildings
        updatedData = syncBuildingIntoParent(updatedData, buildings =>
            buildings.map(b =>
                b[idKey] === entityId ? { ...b, ...updatedEntity } : b
            )
        );

        send({ type: 'UPDATE_DATA', data: updatedData });

        setTimeout(() => {
            controller?.disableInteraction();
            controller?.enableTransform(entityId, (transformData) => {
                debounceHandlePositionChange({
                    longitude: transformData.position[0],
                    latitude: transformData.position[1],
                    rotation: transformData.rotation,
                    size: transformData.size
                });
            });
        }, 400);
    };

    const debounceHandlePositionChange = useDebounce(handlePositioningChange, 300);

    useEffect(() => {
        if(isPositioningMode){
            send({ type: "START_DRAFT" });
            const sourceId = `${namedPath.state}-features`;
            const newController = get3DGraphicsController(mapInstance, sourceId);
            newController.enableTransform(entityId, (transformData) => {
                debounceHandlePositionChange({
                    longitude: transformData.position[0],
                    latitude: transformData.position[1],
                    rotation: transformData.rotation,
                    size: transformData.size
                })
            });
            setController(newController);
        } else {
            send({ type: "END_DRAFT" });
            controller?.disableInteraction();
            setController();
        }
    }, [isPositioningMode, namedPath, entityId])


    // Start positioning mode
    const startPositioningMode = () => {
        // Cache the current positioning values before starting
        if (currentEntity) {
            setCachedPositioning({
                longitude: currentEntity.longitude ?? 0,
                latitude: currentEntity.latitude ?? 0,
                size: currentEntity.size ?? 1,
                rotation: currentEntity.rotation ?? 0
            });
        }
        setIsPositioningMode(true);
        console.log('Started positioning mode');
    };

    // Cancel positioning mode
   const cancelPositioningMode = () => {
        if (cachedPositioning && currentEntity) {
            const currentData = currentState.context?.data || {};
            let updatedData = _.cloneDeep(currentData);

            const restoredEntity = {
                ...currentEntity,
                ...cachedPositioning
            };

            // flat collection
            const currentEntities = updatedData[currentElementType] || [];
            updatedData[currentElementType] = currentEntities.map(b =>
                b[idKey] === entityId ? restoredEntity : b
            );

            // site.buildings
            updatedData = syncBuildingIntoParent(updatedData, buildings =>
                buildings.map(b =>
                    b[idKey] === entityId ? { ...b, ...restoredEntity } : b
                )
            );

            send({ type: 'UPDATE_DATA', data: updatedData });
            send({ type: 'END_DRAFT' });
        }

        setCachedPositioning(null);
        setIsPositioningMode(false);
        console.log('Cancelled positioning mode');
    };
    
    // Toggle positioning mode
    const togglePositioningMode = () => {
        if (isPositioningMode) {
            cancelPositioningMode();
        } else {
            startPositioningMode();
        }
    };

    if (!currentEntity) {
        return <Typography>No data found.</Typography>;
    }

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
                            <div style={{ display: 'flex', gap: 8 }}>
                                <CustomButton
                                    variant="contained"
                                    color="primary"
                                    onClick={setEntityForEdition}
                                    size="small"
                                    startIcon={<Edit />}
                                >
                                    Edit
                                </CustomButton>
                                {!currentEntity?.isDraft && <CustomButton
                                    variant="contained"
                                    color="secondary"
                                    onClick={handleOpenDeleteModal}
                                    size="small"
                                    startIcon={<Delete />}
                                    style={{ backgroundColor: '#d32f2f', color: 'white' }}
                                >
                                    Delete
                                </CustomButton>}
                            </div>
                        )}
                    </div>
                    {currentState.context?.[higherNamedPath?.idKey] && <Typography variant="body2">{higherNamedPath.displayName}: {currentState.context[higherNamedPath.idKey]}</Typography>}
                    <Divider sx={{ my: 2 }} />
                </Box>
                <Box px={2}>
                    <InfoComponent
                        entity={currentEntity}
                        handleChange={handleEntityChange}
                        type={type}
                        entityType={currentElementType}
                        originalEntity={cachedOriginalEntity}
                        disabled={!isInEditMode}
                        modifyTypeCallback={handleTypeModification}
                        allowReadOnlyOverride={currentEntity?.isDraft}
                    />
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
                <Box p={2}>
                    <Divider style={{ margin: '16px 0px' }} />

                    <BuildingThumbnails
                        mapGraphicReferences={mapGraphicReferences}
                        handleCancelNewBuildingMode={() => {}}
                        lowerNamedPath={lowerNamedPath}
                        send={send}
                        upperLevelEntity={currentEntity}
                        onStructureChangeCb={handleStructureChange}
                        currentEntity={currentEntity}
                    />

                    <Divider style={{ margin: '16px 0px' }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: 16 }}>
                            3D Model Positioning
                        </Typography>
                    </div>

                    {!isPositioningMode ? (
                        <CustomButton
                            variant="contained"
                            color="primary"
                            onClick={togglePositioningMode}
                            fullWidth
                        >
                            Adjust Positioning
                        </CustomButton>
                    ) : (
                        <Box>
                            <Box style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
                                <Typography style={{ fontWeight: 600, marginBottom: 8 }}>
                                    Manual Positioning Controls:
                                </Typography>
                                <Box component="ul" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                    <li style={{ display: "flex", alignItems: "center", gap: 8, padding: '4px 0' }}>
                                        <span style={{ backgroundColor: "#0088ff", borderRadius: '50%', width: 14, height: 14, flexShrink: 0 }} />
                                        <Typography variant="body2">Re-locating</Typography>
                                    </li>
                                    <li style={{ display: "flex", alignItems: "center", gap: 8, padding: '4px 0' }}>
                                        <span style={{ backgroundColor: "#ff0000", borderRadius: '50%', width: 14, height: 14, flexShrink: 0 }} />
                                        <Typography variant="body2">Rotation</Typography>
                                    </li>
                                    <li style={{ display: "flex", alignItems: "center", gap: 8, padding: '4px 0' }}>
                                        <span style={{ backgroundColor: "#ffaa00", borderRadius: '50%', width: 14, height: 14, flexShrink: 0 }} />
                                        <Typography variant="body2">Re-sizing</Typography>
                                    </li>
                                </Box>
                            </Box>
                            <Divider style={{ margin: '16px 0' }} />
                            <Typography style={{ fontWeight: 600, marginBottom: 14 }}>
                                Positioning Values:
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="Longitude"
                                        type="number"
                                        value={currentEntity?.longitude ?? 0}
                                        onChange={(e) => handlePositioningChange({'longitude': e.target.value})}
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        inputProps={{ step: 0.000001 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="Latitude"
                                        type="number"
                                        value={currentEntity?.latitude ?? 0}
                                        onChange={(e) => handlePositioningChange({'latitude': e.target.value})}
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        inputProps={{ step: 0.000001 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="Size"
                                        type="number"
                                        value={currentEntity?.size ?? 1}
                                        onChange={(e) => handlePositioningChange({'size': e.target.value})}
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        inputProps={{ step: 0.1, min: 0.1 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="Rotation (degrees)"
                                        type="number"
                                        value={currentEntity?.rotation ?? 0}
                                        onChange={(e) => handlePositioningChange({'rotation': e.target.value})}
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        inputProps={{ step: 1 }}
                                    />
                                </Grid>
                            </Grid>

                            <Box style={{ marginTop: 16, display: 'flex', gap: 16 }}>
                                <CustomButton
                                    variant="outlined"
                                    color="secondary"
                                    onClick={cancelPositioningMode}
                                    style={{ flex: 1 }}
                                >
                                    Cancel Re-Positioning
                                </CustomButton>
                            </Box>
                        </Box>
                    )}
                </Box>
            )}

            {isInEditMode && (
                <div style={{display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
                    <Box style={{display: 'flex', gap: 16, padding: "0px 16px 16px 16px"  }}>
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

            {/* Delete Confirmation Modal */}
            <Dialog open={deleteModalOpen} onClose={handleCloseDeleteModal} maxWidth="sm" fullWidth>
                <DialogTitle>Delete {namedPath?.displayName || 'Entity'}</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete <strong>"{currentEntity?.name}"</strong>?
                        This action cannot be undone and will permanently remove the entity from the system.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteModal} color="primary">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteEntity}
                        color="secondary"
                        variant="contained"
                        style={{ backgroundColor: '#d32f2f', color: 'white' }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
