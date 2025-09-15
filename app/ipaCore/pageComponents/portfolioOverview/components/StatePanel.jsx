import React, { Suspense, lazy, useMemo }  from 'react';
import { Paper, Box } from '@mui/material';
import BuildingDetails from './statePanels/BuildingDetails.jsx';
import ipaConfig from "../../../ipaConfig.js";

const fallback = <div>Loading details…</div>;

export default function StatePanel({ currentState, context, userConfig, chartConfig, snapshot }) {

    const states = Object.keys(ipaConfig.mapPortfolio.statePanel.componentPaths || {});
    const stateKey = useMemo(()=>states.reverse().find(state=>currentState.matches(state)),[currentState]);

    const LazyComponent = useMemo(() => {
        const importer = ipaConfig.mapPortfolio.statePanel.componentPaths[stateKey];
        return importer ? lazy(()=>import(`./statePanels/${importer}`)) : null;
    }, [stateKey]);

    if (!LazyComponent) return null;

    return (
        <Paper elevation={3} sx={{ height: '100%', overflowY: 'auto' }}>
            <Box p={2}>
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
    );
}
