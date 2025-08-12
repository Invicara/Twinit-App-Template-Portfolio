// components/UnitDetails.js
import React from 'react';
import { Typography, Divider } from '@mui/material';

export default function BuildingDetails({ context }) {
    const {data = [], siteId, buildingId} = context;
    const {building : buildings = []} = data;
    const unit = buildings.find(b => b.buildingId == buildingId);
    if (!unit) return <Typography>No data found.</Typography>;

    return (
        <div>
            <Typography variant="h6">Building: {unit.name}</Typography>
            <Typography variant="body2">Site: {siteId}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">Model: {unit.ModelName}</Typography>
        </div>
    );
}
