import React from 'react';
import { Typography, Divider } from '@mui/material';

export default function SiteDetails({ context }) {
    const {data = [], siteId} = context;
    const {building = []} = data;
    const buildings = building.filter(d => d.siteId == siteId);
    const plantName = siteId;

    return (
        <div>
            <Typography variant="h6">Site: {plantName}</Typography>
            <Typography variant="body2">Buildings: {buildings.length}</Typography>
            <Divider sx={{ my: 2 }} />
            {buildings.map((unit, i) => (
                <Typography key={i} variant="body2">
                    {unit.name}
                </Typography>
            ))}
        </div>
    );
}
