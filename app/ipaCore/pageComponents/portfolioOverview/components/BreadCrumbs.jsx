import React, { useMemo, useContext, useEffect } from 'react';
import { makeStyles } from '@material-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { useSelector as useXstateSelector } from '@xstate/react';
import { MapContext, MapMachineContext } from '../PortfolioOverview';
import { selectIsSelectingPosition, setSelectedCoordinate, setIsSelectingPosition, selectSelectedCoordinate, setDraftSite } from '../../../redux/siteSetup';
import { getClickEvent } from '../../../redux/pageComponentState';
import { usePrevious } from "@invicara/ipa-core/modules/IpaUtils";
import {v4 as uuid} from "uuid";
import { addFeatureToMapLayer } from '../../../../client/scripts/mapEntryActions.mjs';
import { PinDrop } from '@material-ui/icons';
import {Link, Tooltip, Typography} from "@material-ui/core";
import HomeIcon from '@material-ui/icons/Home';
import _ from "lodash";
import { defaultNewSiteId } from './statePanels/SiteDetails';

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
    const mapMachineContext = useContext(MapMachineContext);
    const { send, actor } = mapMachineContext || {};
    const currentState = useXstateSelector(actor, state => state);

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
        fontWeight: "700 !important",
        margin: 20,
        marginLeft: 0,
        cursor: "pointer",
        color: "white",
        '&:hover': {
            textDecoration: "underline"
        }
    },
    separator: {
        margin: "0px 10px",
        color: "white"
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
    },
    homeLink: {
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        padding: '4px'
    }
}));

/**
 * Extract full hierarchical path keys from XState v5 snapshot.value
 * e.g. { portfolio: { site: { building: 'idle' } } } -> ['portfolio','site','building']
 */
function getActiveChain(snapshotValue) {
    const chain = [];
    let node = snapshotValue;
    while (node && typeof node === 'object') {
        const [k] = Object.keys(node);
        if (!k) break;
        chain.push(k);
        node = node[k];
    }
    return chain;
}

/**
 * Build a GO_TO payload to bubble to a certain level index.
 * - For each level <= target, include its idKey if present in context (or leave undefined to keep)
 * - For each level > target, explicitly null its idKey to bubble up
 */
function buildGoToEventForLevel(namedPath, context, targetIdx) {
    const evt = { type: 'GO_TO' };
    namedPath.forEach((lvl, idx) => {
        const { idKey } = lvl;
        if (!idKey) return; // top-most usually has no idKey
        if (idx <= targetIdx) {
            // Keep current value if present; if you want to force re-entry, you can set it explicitly
            evt[idKey] = context[idKey] ?? undefined;
        } else {
            // Null deeper ids to bubble up
            evt[idKey] = null;
        }
    });
    return evt;
}

/**
 * Build a GO_TO "home" (top) payload: null all idKeys
 */
function buildGoToHome(namedPath) {
    const evt = { type: 'GO_TO' };
    namedPath.forEach((lvl) => {
        if (lvl.idKey) evt[lvl.idKey] = null;
    });
    return evt;
}

const PortfolioBreadCrumbs = ({namedPath, getLabel}) => {
    const classes = useStyles();
    const { send, actor } = useContext(MapMachineContext);
    const currentState = useXstateSelector(actor, state => state);

    const context = currentState?.context ?? {};
    const chain = getActiveChain(currentState?.value ?? {});
    // chain is like ['portfolio','site','building','modelElement'] depending on where we are

    // map chain to level defs (from namedPath)
    const levels = chain
        .map(stateName => namedPath.find(l => l.state === stateName))
        .filter(Boolean); // only those defined in namedPath

    if (levels.length === 0) {
        return (
            <div className={classes.container}>
                <div className={classes.breadcrumbsSection}>
                    {/* Empty breadcrumbs section */}
                </div>
                <AddSiteSection {...{classes}}/>
            </div>
        );
    }

    return (
        <div className={classes.container}>
            <div className={classes.breadcrumbsSection}>
                {/* Home crumb */}
                <Tooltip title="Home">
                    <Link
                        underline="hover"
                        onClick={() => send(buildGoToHome(namedPath))}
                        className={classes.homeLink}
                    >
                        <HomeIcon style={{ fontSize: 18 }} />
                    </Link>
                </Tooltip>
                {/* Intermediate crumbs (excluding the first top-most if it has no idKey or label) */}
                {levels.map((lvl, idx) => {
                    const isLast = idx === levels.length - 1;
                    const idKey = lvl.idKey;
                    const idVal = idKey ? context[idKey] : undefined;
                    const label = getLabel ? getLabel(lvl, context) : _.startCase(lvl.state);

                    // For the current level (last), render as text; others are clickable links that bubble up
                    if (isLast) {
                        return (
                            <Tooltip
                                key={lvl.state}
                                title={idKey ? `${idKey}: ${idVal ?? '(none)'}` : 'Home'}
                                placement="bottom"
                            >
                                <Typography key={lvl.state} variant="body2" className={currentState.matches(lvl.state) ? classes.activeCrumb : classes.crumb}>
                                    {label}{idKey ? `: ${idVal ?? ''}` : ''}
                                </Typography>
                            </Tooltip>
                        );
                    }

                    return (
                        <React.Fragment key={lvl.state}>
                            <Tooltip
                                title={idKey ? `${idKey}: ${idVal ?? '(none)'}` : 'Home'}
                                placement="bottom"
                            >
                                <Link
                                    underline="hover"
                                    onClick={() => send(buildGoToEventForLevel(namedPath, context, idx))}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <Typography variant="body2" className={currentState.matches(lvl.state) ? classes.activeCrumb : classes.crumb}>
                                        {label}{idKey ? `: ${idVal ?? ''}` : ''}
                                    </Typography>
                                </Link>
                            </Tooltip>
                            <span className={classes.separator}>/</span>
                        </React.Fragment>
                    );
                })}
            </div>
            <AddSiteSection {...{classes}}/>
        </div>
    );
};

export default PortfolioBreadCrumbs;
