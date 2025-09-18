import React from 'react';
import DeployStatusChart from '../DeployStatusBarChart';
import SearchPanel from '../SearchPanel';
import {Box} from "@mui/material";

export default function PortfolioDetails({ context, userConfig, chartConfig, snapshot, send }) {
    return (
        <div>
            <Box pl={2} pr={2} pt={2}>
                <SearchPanel userConfig={userConfig} context={context} />
            
                <DeployStatusChart 
                    userConfig={userConfig} 
                    context={context} 
                    chartConfig={chartConfig} 
                    snapshot={snapshot} 
                    send={send}
                />
            </Box>
        </div>
    );
}
