import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {getTemporaryMapBoxToken} from "../../utils/mapboxUtils.js";
import AutoSizer from 'react-virtualized-auto-sizer';

export default function MapboxMap({ onMapReady }) {
    const mapRef = useRef(null);
    const mapContainerRef = useRef();

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

    useEffect(() => {
        if(!mapboxToken){
            return;
        }
        if (!mapContainerRef.current) return;
        mapboxgl.accessToken = mapboxToken;
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/light-v10',
            center: [2, 46],
            zoom: 5
        });

        map.on('load', () => {
            mapRef.current = map;
            onMapReady(map);
        });

        return () => map.remove();
    }, [mapboxToken]);

    return <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <AutoSizer>
            {({ height, width }) => (
                <div
                    ref={mapContainerRef}
                    style={{ width, height }}
                />
            )}
        </AutoSizer>
    </div>
}
