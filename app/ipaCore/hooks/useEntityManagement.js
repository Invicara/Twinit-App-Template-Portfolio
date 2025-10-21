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
import { getClickEvent, getMapTypes, getSelectedGraphicReference, getSelectedStructure, setSelectedGraphicReference } from "../redux/pageComponentState";
import { generateSquareCoordinates, getGeometryInfo } from "../../client/scripts/mapEntryActions.mjs";
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
    const selectedGraphicReference = useSelector(getSelectedGraphicReference);
    const selectedStructure = useSelector(getSelectedStructure);
    const types = useSelector(getMapTypes);

    const { send, actor } = portContext || {};
    const currentState = useXstateSelector(actor, state => state);

    const [currentElementType, namedPathDict, namedPath] = useMemo(() => {

        const namedPaths = currentState.context.namedPaths[0];

        const namedPathDict = Object.assign({}, ...namedPaths.map(p => ({[p.state]: p})));

        const levels = getActiveLevels(currentState);

        const sPath = levels?.map(el => el.state).join(".");
        const cElementType = sPath?.split(".")?.slice(-1)?.[0];

        const namedPath = namedPaths.find(p => p.state === cElementType);

        return [cElementType, namedPathDict, namedPath]

    }, [currentState])

    const previousClick = usePrevious(clickEvent);
    const previousIsSelectingPosition = usePrevious(isSelectingPosition);

    const draftTypeSchema = types[draftType];

    // Handle element cancellation (remove draft element)
    const handleCancelElement = (elementToRemove, draftingType, namedPath) => {

        const {idKey} = namedPath

        // Remove the draft site from the data
        const currentData = currentState.context?.data || {};
        const currentEntities = currentData[draftingType] || [];

        if(elementToRemove.isDraft){
            const filteredSites = currentEntities.filter(s => s[idKey] !== elementToRemove[idKey]);
            const updatedData = { ...currentData, [draftingType]: filteredSites };

            // Send event to update XState context (removing the site)
            send({
                type: 'UPDATE_DATA',
                data: updatedData
            });
        }
    };

    const prevElementType = usePrevious(currentElementType)

    // First useEffect - extracted from line 117
    useEffect(() => {
        const [draftingType, draftElement] = Object.entries(currentState?.context?.data || {}).map(([k, v]) => {
            const entity = v.find(el => el.isDraft);

            if(entity) return [k, entity]
            else return [];
        }).find(el => el[1]) || [];

        if (draftElement && prevElementType === draftingType && currentElementType !== draftingType) {
            const prev = namedPathDict[prevElementType];
            const next = namedPathDict[currentElementType];
            if (!prev || !next) return;
            const movingToChild = next.scopeLevel > prev.scopeLevel && next.parentState === prev.state;
            // Only cancel if we are NOT moving to the child of the current draft
            if (!movingToChild) {
                handleCancelElement(draftElement, draftingType, namedPathDict[draftingType]);
            }
        }
    }, [currentState, prevElementType, currentElementType, namedPathDict]);

    // Second useEffect - extracted from line 138
    useEffect(() => {
        if(previousIsSelectingPosition && isSelectingPosition && clickEvent?.ground && !_.isEqual(previousClick, clickEvent)){
            dispatch(setSelectedCoordinate([clickEvent.ground.longitude, clickEvent.ground.latitude]));
            dispatch(setIsSelectingPosition(false));
        }

        const draftNamedPath = namedPathDict[draftType];

        if(selectedCoordinate?.length && !isSelectingPosition && draftNamedPath?.feature === "mesh"){

            const [centerLng, centerLat] = selectedCoordinate;

            const parentNamedPath = currentState.context.namedPaths[0].find(p => p.state === draftNamedPath.parentState);
            const currentParentId = currentState.context[parentNamedPath.idKey];

            const positionMatchesParent = clickEvent.elements
                .some(el => el?.extra?.attributeName === parentNamedPath.idKey && el?.extra?.attributeValue === currentParentId);

            send({ type: "END_DRAFT" });

            if(!positionMatchesParent){
                dispatch(setDraftType());
                dispatch(setIsSelectingPosition(false));
                dispatch(setSelectedGraphicReference());
                return;
            }

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
                size: 1,
                rotation: 0,
                structureName: selectedStructure.name,
                graphicRefId: selectedGraphicReference._id,
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

            if (selectedGraphicReference && selectedGraphicReference._id) {
                graphicId = selectedGraphicReference.graphic;
                geometryInfo = getGeometryInfo(graphicId);
                console.log('Retrieved geometry info for graphic:', graphicId, geometryInfo);
            }

            send({
                type: 'START_DRAFT',
            });

            //build GO_TO event params outside timeout closure to prevent memory leaks
            const goTo = {
                siteId: currentState.context.siteId,
                buildingId: newBuildingId
            }
            // Navigate to the newly created building using GO_TO with buildingId
            setTimeout(() => {
                send({
                    type: 'END_DRAFT',
                    siteId: currentState.context.siteId,
                    buildingId: newBuildingId
                });
                send({
                    type: 'GO_TO',
                    ...goTo
                });
            }, 100);

            // Clear the selected coordinate
            dispatch(setSelectedCoordinate());
            dispatch(setIsSelectingPosition(false));
            dispatch(setDraftType());
            dispatch(setSelectedCoordinate([]));

        }
        if(selectedCoordinate?.length && !isSelectingPosition && draftNamedPath?.feature === "polygon"){
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




            //prevent any GO_TO events until timeout is called
            send({
                type: 'START_DRAFT',
            });
            // Navigate to the newly created site
            setTimeout(() => {
                send({
                    type: 'GO_TO',
                    siteId: newSiteId
                });
                send({
                    type: 'END_DRAFT',
                });
            }, 100);

            // Clear the selected coordinate
            dispatch(setSelectedCoordinate());
            dispatch(setIsSelectingPosition(false));
            dispatch(setDraftType());
            dispatch(setSelectedCoordinate([]));
        }
    }, [previousIsSelectingPosition, isSelectingPosition, selectedCoordinate, previousClick, clickEvent, draftTypeSchema, draftType, selectedGraphicReference, namedPathDict, currentState, send, dispatch, mapInstance]);

    return <></>
};
