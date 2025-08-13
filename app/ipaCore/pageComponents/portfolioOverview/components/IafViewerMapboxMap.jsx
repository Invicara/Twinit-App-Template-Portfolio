import React, {useContext, useEffect, useMemo, useRef, useState, useCallback} from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {getTemporaryMapBoxToken} from "../../utils/mapboxUtils.js";
import AutoSizer from 'react-virtualized-auto-sizer';
import {IafViewerDBM} from "@dtplatform/iaf-viewer";
import {ModelContext} from "../../../contexts/ModelContext.js";

const pixelModel = {
    "_uri": "/nameduseritems/688772f22bc93f098c66a8fd",
    "_name": "Empty_Model",
    "_userType": "bim_model_version",
    "_tipId": "688772f22bc93f098c66a8fe",
    "_versions": [
        {
            "_userAttributes": {
                "thumbnail": {
                    "fileVersionId": "103da0a6-3948-4d60-b497-11c3a4e47046",
                    "fileId": "e5b38e33-f01b-4bcc-a2bb-e4e75f70f6e0"
                },
                "bimpk": {
                    "fileVersionId": "aac217f9-9833-4ccd-a47b-54483735e500",
                    "fileId": "ef888847-abc5-4cba-8841-0f0ca666738b"
                },
                "model": {
                    "source": "Autodesk Revit 2025",
                    "originalSource": "None"
                }
            },
            "_userItemDbId": "688772f22bc93f098c66a8fd",
            "_id": "688772f22bc93f098c66a8fe",
            "_isTip": true,
            "_metadata": {
                "_updatedById": "58dd249b-68c5-4b1d-b15c-e78f70852419",
                "_createdAt": 1753707250189,
                "_createdById": "58dd249b-68c5-4b1d-b15c-e78f70852419",
                "_updatedAt": 1753707270926
            },
            "_version": 1
        }
    ],
    "_irn": "itemsvc:nameduseritem:688772f22bc93f098c66a8fd",
    "_namespaces": [
        "DevPr_YU90yexX"
    ],
    "_nextVersion": 2,
    "_shortName": "Empty_Model_modelver",
    "_tipVersion": 1,
    "_versionsCount": 1,
    "_itemClass": "NamedCompositeItem",
    "_userItemId": "empty_model_modelver_eF37dAOG3P",
    "_id": "688772f22bc93f098c66a8fd",
    "_description": "BIM model version by transform",
    "_metadata": {
        "_updatedById": "58dd249b-68c5-4b1d-b15c-e78f70852419",
        "_createdAt": 1753707250130,
        "_createdById": "58dd249b-68c5-4b1d-b15c-e78f70852419",
        "_updatedAt": 1753707250130
    },
    "_kind": "collection",
    "id": "688772f22bc93f098c66a8fd",
    "name": "Empty_Model",
    "shortName": "Empty_Model_modelver",
    "description": "BIM model version by transform",
    "itemClass": "NamedCompositeItem",
    "kind": "collection",
    "userItemId": "empty_model_modelver_eF37dAOG3P",
    "userType": "bim_model_version",
    "lastUpdated": 1753707250130
}
const pixel_model_hidden_elements = ["1","3"];

const EMPTY_ARRAY = []

export default function IafViewerMapboxMap({ onMapReady, OnNotificationCallback, currentState }) {
    const iafViewerDBMRef = useRef();

    const [mapboxToken, setMapboxToken] = useState();

    const getMapboxToken = async () => {
        let token = await getTemporaryMapBoxToken()

        if (token) {
            setMapboxToken(token)
        }
    }

    useEffect(() => {
        // enable mapbox and refresh token every hour
        getMapboxToken();
        const interval = setInterval(() => {
            getMapboxToken();
        }, 1000*60*60);

        return () => clearInterval(interval);
    }, [])

    const {
        selectedModelComposite,
        selectedModelCompositeVersion,
        modelRelatedCollections,
        selectedElement,
        getSelectedElement,
        setSelectedPropRefs,
        sliceElements
    } = useContext(ModelContext);

    const useModel = currentState.matches('portfolio.site.building.idle');

    const [modelComposition, setModelComposition] = useState({
        initial: {
            Structural: true,
            Architectural: true,
            Mechanical: true,
            Electrical: true,
            Plumbing: true,
            FireProtection: true,
            Infrastructural: true
        }
    })

    const internalOnNotificationCallback = useCallback((message)=>{
        console.log("internalOnNotificationCallback",message);
        const iafviewerRef = iafViewerDBMRef.current?.iafviewerRef;
        const viewer = iafviewerRef?.current;
        try {
            if (OnNotificationCallback) {
                try {
                    OnNotificationCallback(message);
                } catch (e){}
            }
            if (message && message.includes("The model has been loaded")) {
                viewer.newToolbarElement.current.showGisViewerModal().then(_=>{
                    setTimeout(()=>{
                        const enableMapBox = async () => {
                            viewer.gisInstance.enableMapBox();
                        }
                        enableMapBox();
                        viewer.newToolbarElement.current.handleEnableMapBox({
                            target: {
                                checked: true
                            }
                        });
                        viewer.toggleGisViewerDiv();
                    },500)


                    //<ReactGis> component instance holds the enableGis function
                    //await IafResourceUtils.loadMapboxResources(this.iafViewer);<---obfuscated
                    //viewer.setState({isGisLoaded: true});
                });
            }
            if (message && message.includes("The model has been found with a")) {
                const mapboxMap = viewer.iafMapBoxGl?.map;
                window._mapboxMap = mapboxMap;
                const mapLoaded = mapboxMap?.loaded();
                if (mapLoaded) {
                    onMapReady(mapboxMap);
                } else if (mapboxMap) {
                    mapboxMap.on('load', () => {
                        onMapReady(mapboxMap);
                    });
                    const loop = () => {
                        if (mapboxMap.loaded()) {
                            onMapReady(mapboxMap);
                        } else {
                            requestAnimationFrame(loop);
                        }
                    };
                    loop();
                }
            }
        } catch (e){
            console.error("internalOnNotificationCallback",e)
        }
    },[]);

    const gis = useMemo(()=>({
        enabled: !!mapboxToken,
        token: mapboxToken
    }),[mapboxToken]);

    return <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <AutoSizer>
            {({ height, width }) => (
                <IafViewerDBM
                    ref={iafViewerDBMRef}
                    serverUri={endPointConfig.graphicsServiceOrigin}
                    modelComposition={modelComposition}
                    enableOptimizedSelection={true}

                    model={useModel ? { ...selectedModelComposite, _versions: [selectedModelCompositeVersion] } : pixelModel}
                    sliceElementIds={useModel ? sliceElements.map(se => [se.package_id, se.source_id]).flat() : EMPTY_ARRAY}
                    hiddenElementIds={pixel_model_hidden_elements}
                    selection={useModel && selectedElement ? [selectedElement.package_id, selectedElement.source_id] : EMPTY_ARRAY}

                    OnSelectedElementChangeCallback={getSelectedElement}
                    OnNotificationCallback={internalOnNotificationCallback}
                    gis={gis}
                />
            )}
        </AutoSizer>
    </div>
}
