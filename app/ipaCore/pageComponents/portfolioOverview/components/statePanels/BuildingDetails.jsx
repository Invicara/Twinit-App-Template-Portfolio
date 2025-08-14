// components/UnitDetails.js
import React, { useContext } from 'react';
import { Typography, Divider, Button, Box } from '@mui/material';
import { PortfolioActorContext } from '../../PortfolioOverview';
import { ModelContext } from '../../../../contexts/ModelContext';

export default function BuildingDetails({ context }) {
    const {data = [], siteId, buildingId} = context;
    const {building : buildings = []} = data;
    const unit = buildings.find(b => b.buildingId == buildingId);
    
    // Get actor context from PortfolioOverview
    const portfolioContext = useContext(PortfolioActorContext);
    const { send } = portfolioContext || {};
    
    // Get ModelContext
    const { availableModelComposites, setSelectedModelComposite, selectedModelComposite } = useContext(ModelContext);

    if (!unit) return <Typography>No data found.</Typography>;

    const handleSelectModel = () => {
        // Example modelElementId - you can modify this based on your needs
        const modelElementId = unit.ModelName;
        
        // Send event to xState machine to set modelElementId
        if (send) {
            send({ 
                type: 'GO_TO', 
                siteId, 
                buildingId, 
                modelElementId 
            });
        }
        
        // Find and set the model composite based on unit's ModelName
        if (availableModelComposites && unit.ModelName) {
            const matchingModel = availableModelComposites.find(
                model => model._name === unit.ModelName || 
                        model._name.includes(unit.ModelName) ||
                        unit.ModelName.includes(model._name)
            );
            
            if (matchingModel && setSelectedModelComposite) {
                console.log('Setting selected model composite:', matchingModel);
                setSelectedModelComposite(matchingModel);
            } else {
                console.log('No matching model found for:', unit.ModelName);
                console.log('Available models:', availableModelComposites.map(m => m._name));
            }
        }
    };

    return (
        <div>
            <Typography variant="h6">Building: {unit.name}</Typography>
            <Typography variant="body2">Site: {siteId}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">Model: {unit.ModelName}</Typography>
            
            <Box sx={{ mt: 2 }}>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleSelectModel}
                    disabled={!send}
                >
                    Select Model
                </Button>
            </Box>
        </div>
    );
}
