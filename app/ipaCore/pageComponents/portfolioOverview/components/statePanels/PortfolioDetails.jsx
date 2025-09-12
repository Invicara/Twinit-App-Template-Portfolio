import React from 'react';
import DeployStatusChart from '../DeployStatusBarChart';
import SearchPanel from '../SearchPanel';

export default function PortfolioDetails({ context, userConfig }) {
    return (
        <div>
            <SearchPanel userConfig={userConfig} context={context} />
            <DeployStatusChart />
        </div>
    );
}
