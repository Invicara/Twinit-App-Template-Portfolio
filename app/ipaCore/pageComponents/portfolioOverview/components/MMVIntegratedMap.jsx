import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getTemporaryMapBoxToken } from "../../utils/mapboxUtils.js";
import AutoSizer from 'react-virtualized-auto-sizer';
import { IafMultiModalViewer } from "@invicara/ipa-core-mmv"

export default function MMVIntegratedMap({ onMapReady, mmvConfig, mmvMode, appId, mmvEventHandler, command }) {
    const mmvContainerRef = useRef();

    const [mapboxToken, setMapboxToken] = useState();
    const intervalRef = useRef();

    const getMapboxToken = async () => {
        let token = await getTemporaryMapBoxToken()

        if (token) {
            setMapboxToken(token)
        }
    }

    useEffect(() => {
        // enable mapbox and refresh token every hour
        getMapboxToken();
        intervalRef.current = setInterval(() => {
            getMapboxToken();
        }, 1000*60*60);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if(!mapboxToken) return;

        clearInterval(intervalRef.current);
        mapboxgl.accessToken = mapboxToken;

    }, [mapboxToken]);

    // Handle MMV events and extract map reference
    const handleMMVEvent = (event) => {
        
        // Extract map reference from MMV when available
        if (event.eventName === 'viewer_ready' && event?.payload?.map) {
            console.log('Viewer is ready:', event.payload.map);

            // Pass the map reference to parent component for layer management
            if (onMapReady) {
                onMapReady(event.payload.map);
            }
        }

        // if(event.eventName === 'selection_update'){
        //   console.log("SELECTION_ELEMENTS", event.payload.elements);
        //   // Handle 3D model feature selection
        //  const features = event.payload.elements.filter(el => el.elementType === '2d_site' || el.elementType === 'building_represetation');
        //  if (features.length > 0) {
        //    console.log("Found registered features", features);
        //  }

        // }        
        // Forward event to external handler if provided
        if (mmvEventHandler) {
            mmvEventHandler(event);
        }
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <div
                        ref={mmvContainerRef}
                        style={{ width, height }}
                    >
                        <IafMultiModalViewer 
                            mode={"mmvGIS"} 
                            config={{
                            accessToken: mapboxToken,
                            style: 'mapbox://styles/mapbox/light-v10',
                            // Layer information for event handling
                            layerInfo: {
                                'site-features-layer': { 
                                    idField: 'siteId',
                                    elementType: '2d_site',
                                    extraAttributes: ['name'],
                                    fromMapboxID: (id, attrs) => id,
                                    toMapboxID: (id) => id
                                },
                                'building-features-layer': { 
                                    idField: 'buildingId',
                                    elementType: 'building_represetation',
                                    extraAttributes: ["latitude", "longitude"],
                                    fromMapboxID: (id, attrs) => id,
                                    toMapboxID: (id) => id
                                }
                            },
                            initialCameraPosition: {
                                position: [2, 46],
                                zoom: 5,
                                rotation: {
                                    pitch: 0,
                                    yaw: 0
                                }
                            }, height, width
                            }} 
                            eventHandler={handleMMVEvent} 
                            appId={appId}
                            command={command}
                            {...{ width, height }}
                        />
                    </div>
                )}
            </AutoSizer>
        </div>
    );
}
