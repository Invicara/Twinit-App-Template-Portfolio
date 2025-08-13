import React, {useEffect, useMemo} from 'react';
import { useActor, useSelector, useMachine } from '@xstate/react';
import MapboxMap from './components/MapboxMap';
import StatePanel from './components/StatePanel';
import { Grid, Box } from '@mui/material';
import './PortfolioOverview.css'
import {createMachine} from "./machines/hierarchicalMapMachine.js";
const DEFAULT_PATHS = [
    [
        { state: 'portfolio', idKey: null },
        { state: 'site', idKey: 'siteId', feature: "polygon", api: "site/all" },
        { state: 'building', idKey: 'buildingId', feature: "point", api: "building/all" },
        { state: 'modelElement', idKey: 'modelElementId' },
    ]
]

export default function PortfolioOverview({handler}) {
    const namedPathsConfig = handler?.componentConfig;
    const namedPaths = useMemo(()=>namedPathsConfig?.namedPaths || DEFAULT_PATHS,[]);
    const machineDef = useMemo(()=>createMachine("mapMachine",namedPaths),[namedPaths]);
    const [snapshot, send, actor] = useMachine(machineDef);
    useEffect(()=>{
        const subscription = actor.subscribe((state, e) => {
            console.log("PortfolioOverview Machine state changed",state,{state: JSON.parse(JSON.stringify(state.value)) });
        });
        return ()=> subscription.unsubscribe();
    },[actor])

    const currentState = useSelector(actor, state => state);

    return (
        <Grid container style={{ height: "100%" }}>
            <Grid item style={{ width: 400, height: '100%'}}>
                <StatePanel currentState={currentState} context={currentState.context} send={actor.send} />
            </Grid>
            <Grid item xs style={{ height: "100%" }}>
                <MapboxMap onMapReady={(map) => actor.send({ type: 'MAP_READY', map, mmvSend: undefined })} />
            </Grid>
        </Grid>
    );
}
