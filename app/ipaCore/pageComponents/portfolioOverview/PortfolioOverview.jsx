import React, {useEffect, useMemo, useState, createContext, useCallback, useRef} from 'react';
import { useActor, useSelector as useXstateSelector, useMachine } from '@xstate/react';
import { makeStyles, CircularProgress, Box } from '@material-ui/core';
import MMVIntegratedMap from './components/MMVIntegratedMap';
import StatePanel from './components/StatePanel';
import PortfolioBreadCrumbs from './components/Breadcrumbs/BreadCrumbs.jsx';
import SimpleViewerView from '../simpleViewer/SimpleViewerView';
import { Grid } from '@mui/material';
import './PortfolioOverview.css'
import './components/map/darkMap.scss'
import {createMachine} from "./machines/hierarchicalMapMachine";
import ipaConfig from "../../ipaConfig.js";
import { useDispatch, useSelector as useReduxSelector, useStore } from 'react-redux';
import { selectIsSelectingPosition } from '../../redux/siteSetup.js';
import {ScriptCache} from "@invicara/ipa-core/modules/IpaUtils";
import clsx from "clsx";
import {Custom2D3DToggle} from "./components/map/control/Custom2D3DToggle";
import { getMapGraphicReferences, getStructures, setMapGraphicReferences, setMapTypes, setStructures } from '../../redux/pageComponentState.js';
import {useSelector} from "react-redux";
import {Legend} from "./components/map/control/Legend.jsx";
import {flushSync} from "react-dom";
import PopupPortal from "./components/map/popup/PopupPortal.jsx";
import StatusPopup from "./components/map/popup/StatusPopup.jsx";
import {usePopupState} from "./components/map/popup/usePopupState.jsx";
import { useGraphicsVisibility } from '../../hooks/useGraphicsVisibility.js';
import { useNewEntityManagement } from '../../hooks/useEntityManagement.js';
import { getMapPinCursorValue } from '../../utils/mapPinCursor.js';

const useStyles = makeStyles((theme) => ({
    container: {
        height: "100%"
    },
    secondaryHeader: {
        backgroundColor: "#333",
        height: "40px",
        padding: "0 8px",
        position: "relative",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "calc(100%)",
        zIndex: 10
    },
    headerInner: {
        width: "100%"
    },
    headerFlex: {
        display: "flex",
        padding: 0,
        height: "40px"
    },
    breadcrumbsContainer: {
        padding: 0,
        flexGrow: 1
    },
    mainContent: {
        height: "calc(100% - 40px)",
        flexWrap: "nowrap !important"
    },
    statePanel: ({stateKey}) => (  {
        width: 580,
        height: '100%'
    }),
    searchPanel: {
        width: 580,
        height: '100%'
    },
    viewerContainer: {
        height: "100%",
        position: "relative"
    },
    mmvContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        height: "100%",
        width: "100%"
    },
    simpleViewerContainer: {
        position: "relative",
        top: 0,
        left: 0,
        height: "100%",
        width: "100%"
    }
}));

// Create context for the actor
export const MapMachineContext = createContext();
export const MapContext = createContext();
export const DEFAULT_PATHS = [
    [
        { displayName: "Portfolio", state: 'portfolio', idKey: null, scopeLevel: 0 },
        { displayName: "Site", state: 'site', idKey: 'siteId', feature: "polygon", api: "site/all", scopeLevel: 1, collShortName: "geo_sites_coll", parentState: "portfolio" },
        { displayName: "Building", state: 'building', idKey: 'buildingId', feature: "mesh", api: "building/all", scopeLevel: 2, collShortName: "building_coll", parentState: "site" },
        { displayName: "Model Element", state: 'modelElement', idKey: 'modelElementId', scopeLevel: 3, parentState: "building" },
    ]
]

// HOC to ensure structures and mapRefs are loaded before initializing the map
function withMapDataInitialization(Component) {
    return function WrappedPortfolioOverview(props) {
        const dispatch = useDispatch();
        const structures = useSelector(getStructures);
        const mapRefs = useSelector(getMapGraphicReferences);
        
        const componentConfig = props.handler?.componentConfig;
        const namedPaths = useMemo(() => componentConfig?.namedPaths || DEFAULT_PATHS, [componentConfig]);
        
        const [isInitializing, setIsInitializing] = useState(true);

        useEffect(() => {
            const initializeMapData = async () => {
                try {
                    // Fetch structures and map representations in parallel
                    const [mapStructures, mapGraphicReferences] = await Promise.all([
                        ScriptCache.runScript("getMapStructures", {namedPaths}),
                        ScriptCache.runScript("getGraphicReferences", {namedPaths})
                    ]);
                    
                    // Set both states before initialization completes
                    dispatch(setStructures(mapStructures));
                    dispatch(setMapGraphicReferences(mapGraphicReferences));
                    
                    setIsInitializing(false);
                } catch (error) {
                    console.error('Error initializing map data:', error);
                    setIsInitializing(false);
                }
            };

            initializeMapData();
        }, [namedPaths, dispatch]);

        // Check if both structures and mapRefs are ready
        const isDataReady = !isInitializing && 
                           Object.keys(structures || {}).length > 0 && 
                           (mapRefs || []).length > 0;

        if (!isDataReady) {
            return (
                <Box 
                    display="flex" 
                    justifyContent="center" 
                    alignItems="center" 
                    height="100vh"
                    bgcolor="#ffffff"
                >
                    <CircularProgress />
                </Box>
            );
        }

        return <Component {...props} />;
    };
}

function PortfolioOverview({handler, userConfig, selectedItems}) {
    const [dialogOpen, setDialogOpen] = useState()
    const store = useStore();
    const dispatch = useDispatch();

    const componentConfig = handler?.componentConfig;
    const namedPaths = useMemo(()=>componentConfig?.namedPaths || DEFAULT_PATHS,[componentConfig]);
    const legendPath = useMemo(()=>componentConfig?.legendPath || "building",[componentConfig]);

    // Create machine with Redux context - structures and mapRefs are guaranteed to be set by HOC
    const machineDef = useMemo(()=>{
        return createMachine("mapMachine", namedPaths, {
            initialContext: {
                reduxStore: store,
                reduxDispatch: dispatch
            }
        });
    },[namedPaths, dispatch, store]);

    const [snapshot, send, actor] = useMachine(machineDef);

    const currentState = useXstateSelector(actor, state => state);
    const states = Object.keys(ipaConfig.mapPortfolio.statePanel.componentPaths || {});
    const stateKey = useMemo(()=> {
        if(!currentState?.matches) return;
        return states.reverse().find(state=> currentState?.matches(state));
    },[currentState]);

    const classes = useStyles({ stateKey });

    // MMV Configuration state -> this should be removed to a user config or a script
    const [mmvConfig, setMmvConfig] = useState();

    useEffect(()=>{
        const fetchGisConfig = async () => {
            const config = await ScriptCache.runScript("getGISConfig", {namedPaths});
            const controlsConfig = config?.mapControlsConfig || [];
            if (controlsConfig) {
                for (let i = 0; i < controlsConfig.length; i++) {
                    const controlConfig = controlsConfig[i];
                    if (typeof controlConfig === "string" && controlConfig === '2d3d') {
                        controlsConfig[i] = {type: Custom2D3DToggle}
                    } else if (controlConfig.type === '2d3d') {
                        controlsConfig[i] = {
                            ...controlConfig,
                            type: Custom2D3DToggle
                        }
                    }
                }
            }
            setMmvConfig(config);
        }

        const fetchMapTypes = async () => {
            const types = await ScriptCache.runScript("getMapTypes", {namedPaths});
            dispatch(setMapTypes(types));
        }

        fetchGisConfig();
        fetchMapTypes();
    },[namedPaths, dispatch])

    const isSelectingPosition = useSelector(selectIsSelectingPosition);
    const [mmvMode, setMmvMode] = useState("");

    // Command state for MMV communication
    const [command, setCommandWithoutFlush] = useState([]);

    const setCommand = useCallback((command)=>{
        setTimeout(() => {
            flushSync(() => {
                setCommandWithoutFlush(command);
            })
        })
    },[setCommandWithoutFlush])

    // Read MMV config from project or user config
    const readMMVConfigFromProject = () => {
        let newConfig = selectedItems?.selectedProject?._userAttributes?.mmvConfig;
        console.log('MMV Config from project:', {newConfig});
        if (newConfig) {
            setMmvMode(newConfig.mode);
            setMmvConfig({...newConfig});
        }
    };

    useEffect(() => {
        // Check for MMV configuration in user config
        let newConfig = handler?.mmvConfig || handler?.componentConfig?.mmvConfig;
        if (newConfig) {
            console.log('MMV Config from user/handler:', {newConfig});
            if (newConfig.mode === "project") {
                readMMVConfigFromProject();
            } else {
                setMmvMode(newConfig.mode);
                setMmvConfig({...newConfig});
            }
        }
    }, [userConfig, handler, selectedItems]);

    useEffect(()=>{
        const subscription = actor.subscribe((state, e) => {
            console.log("PortfolioOverview Machine state changed",state,{state: JSON.parse(JSON.stringify(state.value)) });
        });
        return ()=> subscription.unsubscribe();
    },[actor])


    // Extract modelElementId from current state context
    const modelElementId = currentState?.context?.modelElementId;
    const showSimpleViewer = modelElementId != null && modelElementId !== undefined;

    // Track previous display state to detect switches
    const [mapInstance, setMapInstance] = useState(null);

    useEffect(() => {
        return () => {
            setMapInstance();//releasing map from memory
        }
    }, []);

    // Handle display switching and map refresh
    useEffect(() => {
        // If switching back to MMV map, trigger resize after a short delay
        if (!showSimpleViewer && mapInstance) {
            setTimeout(() => {
                console.log('Refreshing map after display switch');
                try {
                    // Trigger map resize to fix rendering issues
                    mapInstance.resize();
                    // Force a repaint
                    mapInstance.triggerRepaint();
                } catch (error) {
                    console.error('Error refreshing map:', error);
                }
            }, 100);
        }
    }, [showSimpleViewer, mapInstance]);

    const handleMMVEvent = useCallback((event) => {
        //console.log('PortfolioOverview MMV Event:', event);
        // Handle MMV events as needed
    },[]);


    const onMapReady = useCallback((map) => {


        setMapInstance(map); // Store map instance for refresh
        actor.send({ type: 'MAP_READY', map, mmvSend: setCommand, setPopupState });
    },[actor, setCommand])

    const mapMachineContextValue = useMemo(() => {
        console.log('actor', actor)

        return { actor, send: actor.send }
    }, [actor]);

    const mapContextValue = useMemo(() => {
        return {setCommand, mapInstance }
    }, [setCommand, mapInstance]);

    useNewEntityManagement({mapInstance, portContext: mapMachineContextValue});
    useGraphicsVisibility({mapInstance, portContext: mapMachineContextValue});

    const [popupState, setPopupState] = usePopupState({ open:false });

    useEffect(() => {
        const hasSeenDialog = localStorage.getItem("welcomeDialogDismissed");
        if (!hasSeenDialog) {
            setDialogOpen(true)
        }
    }, [])

    return (
        <MapContext.Provider value={mapContextValue}>
            <MapMachineContext.Provider value={mapMachineContextValue}>                
                <div className={classes.container}>
                    <div className={classes.secondaryHeader}>
                        <div className={classes.headerInner}>
                            <div className={classes.headerFlex}>
                                <div className={classes.breadcrumbsContainer}>
                                    <PortfolioBreadCrumbs namedPath={namedPaths[0]} getLabel={lvl => lvl.displayName} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <Grid container className={classes.mainContent}>
                        <StatePanel
                            handler={handler}
                            currentState={currentState}
                            context={currentState.context}
                            send={actor.send}
                            className={classes.statePanel}
                            userConfig={userConfig}
                            snapshot={snapshot}
                        />
                        <Grid item xs className={classes.viewerContainer}>
                            <div
                                className={clsx(classes.mmvContainer, "dark-map", {'map-selecting-position' : isSelectingPosition})}
                                style={{
                                    visibility: showSimpleViewer ? 'hidden' : 'visible',
                                    opacity: showSimpleViewer ? 0 : 1,
                                    pointerEvents: showSimpleViewer ? 'none' : 'auto',
                                    zIndex: showSimpleViewer ? 0 : 1,
                                    ...(isSelectingPosition ? { cursor: getMapPinCursorValue() } : {})
                                }}
                            >
                                <MMVIntegratedMap
                                    onMapReady={onMapReady}
                                    mmvConfig={mmvConfig}
                                    mmvMode={mmvMode}
                                    appId={ipaConfig.applicationId}
                                    mmvEventHandler={handleMMVEvent}
                                    command={command}
                                />
                                {/* <GraphicPortal/> */}
                                <Legend map={mapInstance} path={legendPath}/>

                                {popupState.config && <PopupPortal
                                    map={mapInstance}
                                    open={popupState.open}
                                    lngLat={popupState.lngLat}
                                    popupOptions={{
                                        className: "popup--dark",
                                        closeButton: false,
                                        //anchor: "auto",
                                        //offset: { bottom: [0, -(24 + 8)], "bottom-left": [0, -(24 + 8)], "bottom-right": [0, -(24 + 8)] }
                                        anchor: 'bottom',
                                        offset: [0, -(24 + 8)]
                                    }}
                                    onClose={() => setPopupState((s) => ({ ...s, open: false }))}
                                >
                                    {/* This subtree has full app context */}
                                    <StatusPopup
                                        data={popupState.data}
                                        config={popupState.config}
                                        actor={actor}
                                    />
                                </PopupPortal>}
                            </div>

                            <div
                                className={classes.simpleViewerContainer}
                                style={{
                                    visibility: showSimpleViewer ? 'visible' : 'hidden',
                                    opacity: showSimpleViewer ? 1 : 0,
                                    pointerEvents: showSimpleViewer ? 'auto' : 'none',
                                    zIndex: showSimpleViewer ? 1 : 0
                                }}
                            >
                                <SimpleViewerView
                                    key={modelElementId}
                                    handler={handler}
                                />
                            </div>
                        </Grid>
                    </Grid>
                </div>
            </MapMachineContext.Provider>
        </MapContext.Provider>
    );
}

// Export the HOC-wrapped component
export default withMapDataInitialization(PortfolioOverview);
