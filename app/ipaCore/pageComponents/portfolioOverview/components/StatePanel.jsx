import React, { Suspense, lazy, useMemo }  from 'react';
import { Paper, Box, Grid } from '@mui/material';
import ipaConfig from "../../../ipaConfig.js";

const fallback = <div>Loading details…</div>;

export default function StatePanel({ currentState, context, userConfig, chartConfig, snapshot, className }) {

    const states = useMemo(()=>Object.keys(ipaConfig.mapPortfolio.statePanel.componentPaths || {}),[]);
    const stateKey = useMemo(()=>states.toReversed().find(state=>currentState.matches(state)),[states, currentState]);

    const LazyComponent = useMemo(() => {
        if(!stateKey){
            return null
        }
        const importer = ipaConfig.mapPortfolio.statePanel.componentPaths[stateKey];
        return importer ? lazy(()=>import(`./statePanels/${importer}`)) : null;
    }, [stateKey]);

    if (!LazyComponent) return null;

    return (
        <Grid item className={className}>
            <Paper elevation={3} sx={{ height: '100%', overflowY: 'auto' }}>
                <Box p={0}>
                    <Suspense fallback={fallback}>
                    <LazyComponent 
                        context={context} 
                        userConfig={userConfig} 
                        chartConfig={chartConfig} 
                        snapshot={snapshot} 
                    /> 
                </Suspense>
                </Box>
            </Paper>
        </Grid>
    );
}
