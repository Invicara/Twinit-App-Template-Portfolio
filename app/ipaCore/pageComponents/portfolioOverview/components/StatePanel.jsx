import React, { Suspense, lazy, useMemo }  from 'react';
import { Paper, Box } from '@mui/material';
import BuildingDetails from './statePanels/BuildingDetails.jsx';
import ipaConfig from "../../../ipaConfig.js";

const fallback = <div>Loading details…</div>;

export default function StatePanel({ currentState, context, send }) {

    const LazyComponent = useMemo(() => {
        const importer = ipaConfig.mapPortfolio.statePanel.componentPaths[stateKey];
        return importer ? lazy(()=>import(`./statePanels/${importer}`)) : null;
    }, [stateKey]);

    if (!LazyComponent) return null;

    return (
        <Paper elevation={3} sx={{ height: '100%', overflowY: 'auto' }}>
            <Box p={2}>
                <Suspense fallback={fallback}>
                    <LazyComponent context={context} />
                </Suspense>
            </Box>
        </Paper>
    );
}
