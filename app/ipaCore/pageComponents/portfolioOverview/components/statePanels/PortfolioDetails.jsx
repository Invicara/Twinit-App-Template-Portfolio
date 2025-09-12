import React, { useContext, useEffect } from 'react';
import { Typography, Divider } from '@mui/material';
import SearchPanel from '../SearchPanel';

export default function PortfolioDetails({ context, userConfig }) {
    const {data = {}} = context;
    const {building: buildings = []} = data;


    return (
        <div>
            <SearchPanel userConfig={userConfig} context={context} />
            {/* <Typography variant="h6">Portfolio</Typography> */}
            {/* <Typography variant="body2">Total: {buildings.length}</Typography>
            <Divider sx={{ my: 2 }} />
            {buildings.map((item, i) => (
                <Typography key={i} variant="body2">
                    {item.name}
                </Typography>
            ))} */}
        </div>
    );
}
