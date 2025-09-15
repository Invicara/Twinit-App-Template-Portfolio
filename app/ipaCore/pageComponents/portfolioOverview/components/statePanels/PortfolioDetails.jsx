import React from 'react';
import DeployStatusChart from '../DeployStatusBarChart';
import SearchPanel from '../SearchPanel';

export default function PortfolioDetails({ context, userConfig, chartConfig, snapshot }) {
    return (
        <div>
            <SearchPanel userConfig={userConfig} context={context} />
            <DeployStatusChart userConfig={userConfig} context={context} chartConfig={chartConfig} snapshot={snapshot} />
        </div>
    );
}
