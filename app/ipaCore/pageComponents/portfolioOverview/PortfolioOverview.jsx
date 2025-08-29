import React, {useEffect, useMemo, useState, createContext} from 'react';
import { useActor, useSelector, useMachine } from '@xstate/react';
import { makeStyles } from '@material-ui/core';
import MapboxMap from './components/MapboxMap';
import MMVIntegratedMap from './components/MMVIntegratedMap';
import StatePanel from './components/StatePanel';
import PortfolioBreadCrumbs from './components/BreadCrumbs';
import SimpleViewerView from '../simpleViewer/SimpleViewerView';
import { Grid } from '@mui/material';
import './PortfolioOverview.css'
import './components/map/darkMap.scss'
import {createMachine} from "./machines/hierarchicalMapMachine";
import ipaConfig from "../../ipaConfig.js";
import {ScriptCache} from "@invicara/ipa-core/modules/IpaUtils";
import clsx from "clsx";
import {Custom2D3DToggle} from "./components/map/Custom2D3DToggle";

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
        height: "calc(100% - 40px)"
    },
    statePanel: {
        width: 400,
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
export const MapStateContext = createContext();
const defaultBuildingMapConfig = {
    cluster: {
        sourceOptions: {
            cluster: true,
            clusterRadius: 60,
            clusterMaxZoom: 14
        }
    }
}
const DEFAULT_PATHS = [
    [
        { state: 'portfolio', idKey: null },
        { state: 'site', idKey: 'siteId', feature: "polygon", api: "site/all" },
        { state: 'building', idKey: 'buildingId', feature: "point", api: "building/all", options: defaultBuildingMapConfig },
        { state: 'modelElement', idKey: 'modelElementId' },
    ]
]

export default function PortfolioOverview({handler, userConfig, selectedItems}) {
    const classes = useStyles();
    const namedPathsConfig = handler?.componentConfig;
    const namedPaths = useMemo(()=>namedPathsConfig?.namedPaths || DEFAULT_PATHS,[]);
    const machineDef = useMemo(()=>createMachine("mapMachine",namedPaths),[namedPaths]);
    const [snapshot, send, actor] = useMachine(machineDef);

    // MMV Configuration state -> this should be removed to a user config or a script
    const [mmvConfig, setMmvConfig] = useState();

    useEffect(()=>{
        const fetchGisConfig = async () => {
            const config = await ScriptCache.runScript("getGISConfig", {namedPaths});
            const controlsConfig = config?.mapControlsConfig || [];
            console.log({ Custom2D3DToggle })
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
        fetchGisConfig();
    },[namedPaths])

    const [mmvMode, setMmvMode] = useState("");

    // Command state for MMV communication
    const [command, setCommand] = useState([]);

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
        let newConfig = userConfig?.handlers?.portfolioOverview?.mmvConfig || handler?.componentConfig?.mmvConfig;
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

    const currentState = useSelector(actor, state => state);

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

    const handleMMVEvent = (event) => {
        //console.log('PortfolioOverview MMV Event:', event);
        // Handle MMV events as needed
    };

    return (
        <MapStateContext.Provider value={{ actor, send: actor.send, currentState }}>
            <div className={classes.container}>
                <div className={classes.secondaryHeader}>
                    <div className={classes.headerInner}>
                        <div className={classes.headerFlex}>
                            <div className={classes.breadcrumbsContainer}>
                                <PortfolioBreadCrumbs namedPath={namedPaths[0]} />
                            </div>
                        </div>
                    </div>
                </div>

                <Grid container className={classes.mainContent}>
                    <Grid item className={classes.statePanel}>
                        <StatePanel currentState={currentState} context={currentState.context} send={actor.send} />
                    </Grid>
                    <Grid item xs className={classes.viewerContainer}>
                        <div
                            className={clsx(classes.mmvContainer, "dark-map")}
                            style={{
                                visibility: showSimpleViewer ? 'hidden' : 'visible',
                                opacity: showSimpleViewer ? 0 : 1,
                                pointerEvents: showSimpleViewer ? 'none' : 'auto',
                                zIndex: showSimpleViewer ? 0 : 1
                            }}
                        >
                            <MMVIntegratedMap
                                onMapReady={(map) => {
                                    setMapInstance(map); // Store map instance for refresh
                                    if(!map.id){
                                        map.id = Math.random();
                                        console.log("MAP READY", map.id)
                                    }
                                    else {
                                        console.log("MAP READY SAME", map.id)
                                    }
                                    actor.send({ type: 'MAP_READY', map, mmvSend: setCommand });
                                }}
                                mmvConfig={mmvConfig}
                                mmvMode={mmvMode}
                                appId={ipaConfig.applicationId}
                                mmvEventHandler={handleMMVEvent}
                                command={command}
                            />
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
                                handler={handler}
                            />
                        </div>
                    </Grid>
                </Grid>
            </div>
        </MapStateContext.Provider>
    );
}
