import React, { Suspense, lazy, useMemo }  from 'react';
import { Paper, Box } from '@mui/material';
import ipaConfig from "../../../ipaConfig.js";

const fallback = <div>Loading details…</div>;

export default function StatePanel({ currentState, context, send }) {

    const states = Object.keys(ipaConfig.mapPortfolio.statePanel.componentPaths || {});
    const stateKey = useMemo(()=>states.reverse().find(state=>currentState.matches(state)),[currentState]);

    const LazyComponent = useMemo(() => {
        const importer = ipaConfig.mapPortfolio.statePanel.componentPaths[stateKey];
        return importer ? lazy(()=>import(`./statePanels/${importer}`)) : null;
    }, [stateKey]);

    if (!LazyComponent) return null;

    return (
        <Paper elevation={3} sx={{ height: '100%', overflowY: 'auto' }}>
            <Box p={0}>
                <Suspense fallback={fallback}>
                    <LazyComponent context={context} />
                </Suspense>
            </Box>
        </Paper>
    );
}
