import React, {useEffect, useMemo, useRef, useState} from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getTemporaryMapBoxToken } from "../../utils/mapboxUtils.js";
import { IafMultiModalViewer } from "@invicara/ipa-core-mmv"
import { setClickEvent } from '../../../redux/pageComponentState.js';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsSelectingPosition } from '../../../redux/siteSetup.js';
import useAutoRefreshToken from "../../../hooks/useAutoRefreshMapboxToken.jsx";

export default function MMVIntegratedMap({ onMapReady, mmvConfig, mmvMode, appId, mmvEventHandler, command }) {

    const dispatch = useDispatch();
    const isSelectingPosition = useSelector(selectIsSelectingPosition);

    const mmvContainerRef = useRef();
    useEffect(()=>{
        return () => {
            mmvContainerRef.current?.remove()
        }
    },[])

    const [mapboxToken, setMapboxToken] = useState();
    const intervalRef = useRef();

    const getMapboxToken = async () => {
        let token = await getTemporaryMapBoxToken()

        if (token) {
            setMapboxToken(token)
        }
    }
    useAutoRefreshToken();

    useEffect(() => {
        getMapboxToken();
        // enable mapbox and refresh token every 55 min
        intervalRef.current = setInterval(() => {
            getMapboxToken();
        }, 1000*60*55);

        return ()=> {
            clearInterval(intervalRef.current);
        }
    }, []);

    useEffect(() => {
        if(!mapboxToken) return;
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

        if(event.payload.action === "click"){
            const ground = event?.payload.ground || {};
            const elements = event?.payload.elements || [];
            const {latitude, longitude, point, screenCoordinates} = ground;
            const serializableEvent = {
                elements,
                ground: {
                    latitude, longitude, point, screenCoordinates
                }
            }
            dispatch(setClickEvent(serializableEvent))
        }

        // }
        // Forward event to external handler if provided
        if (mmvEventHandler) {
            mmvEventHandler(event);
        }
    }

    const mergedMMVConfig = useMemo(() => {
        return {accessToken: mapboxToken, ...mmvConfig}
    },[mmvConfig,mapboxToken])

    if(!mapboxToken) return <></>

    return (
        <div style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            cursor: isSelectingPosition ? `url('/icons/map-pin.svg') 12 24, crosshair` : 'default'
        }}>
            <div
                ref={mmvContainerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    cursor: isSelectingPosition ? `url('/icons/map-pin.svg') 12 24, crosshair` : 'default'
                }}
            >
                {mapboxToken && <IafMultiModalViewer
                    mode={"mmvGIS"}
                    config={mergedMMVConfig}
                    eventHandler={handleMMVEvent}
                    appId={appId}
                    command={command}
                    style={{
                        width: '100%',
                        height: '100%',
                        cursor: isSelectingPosition ? `url('/icons/map-pin.svg') 12 24, crosshair` : 'default'
                    }}
                />}
            </div>
        </div>
    );
}
