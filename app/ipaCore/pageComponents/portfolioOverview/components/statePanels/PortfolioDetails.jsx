import React from 'react';
import DeployStatusChart from '../DeployStatusBarChart';
import SearchPanel from '../SearchPanel';
import {Box} from "@mui/material";

export default function PortfolioDetails({ context, userConfig }) {
    return (
        <Box p={2}>
            <SearchPanel userConfig={userConfig} context={context} />
            <DeployStatusChart />
        </Box>
    );
}
