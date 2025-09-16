import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionActions from '@mui/material/AccordionActions';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Button from '@mui/material/Button';
import BuildingDetails from "./BuildingDetails.jsx";
import ModelDetails from "./ModelDetails.jsx";
import {useContext, useEffect, useState} from "react";
import {ModelContext} from "../../../../../contexts/ModelContext.js";
import {Box} from "@material-ui/core";
import CustomButton from "../../../../../components/atoms/CustomButton.jsx";
import {MapMachineContext} from "../../../PortfolioOverview.jsx";

export default function BuildingInfo({context}) {
    const { data = [], siteId, buildingId } = context;
    const { building: buildings = [] } = data;
    const currentBuilding = buildings.find(b => b.buildingId == buildingId);
    const { selectedModelComposite, availableModelComposites, setSelectedModelComposite } = useContext(ModelContext);
    const { send, actor } = useContext(MapMachineContext);
    const [model, setModel] = useState({});

    useEffect(() => {
        // Find and set the model composite based on building's ModelName
        if (availableModelComposites && currentBuilding.ModelName) {
            const matchingModel = availableModelComposites.find(
                model => model._name === currentBuilding.ModelName ||
                    model._name.includes(currentBuilding.ModelName) ||
                    currentBuilding.ModelName.includes(model._name)
            );

            if (matchingModel) {
                console.log('Setting model composite lacally:', matchingModel);
                setModel(matchingModel);
            } else {
                console.log('No matching model found for:', currentBuilding.ModelName);
                console.log('Available models:', availableModelComposites.map(m => m._name));
                setModel()
            }
        }
    }, [currentBuilding]);

    const handleSelectModel = () => {
        // Example modelElementId - you can modify this based on your needs
        const modelElementId = currentBuilding.ModelName;

        // Send event to xState machine to set modelElementId - include siteId as specified
        if (send) {
            send({
                type: 'GO_TO',
                siteId,
                buildingId,
                modelElementId
            });
        }

        console.log('Setting model composite globally:', model);
        setSelectedModelComposite && selectedModelComposite!=model && setSelectedModelComposite(model)
    };

        return (
        <Box p={0} mb={2}>
            <Accordion>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1-content"
                    id="panel1-header"
                >
                    Information
                </AccordionSummary>
                <AccordionDetails>
                    <BuildingDetails context={context} />
                </AccordionDetails>
            </Accordion>
            <Accordion defaultExpanded>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel2-content"
                    id="panel2-header"
                >
                    Model information
                </AccordionSummary>
                <AccordionDetails>
                    {model && <ModelDetails context={context} selectedModelComposite={model} />}
                    <Box p={2}>
                        <CustomButton
                            variant="contained"
                            color="primary"
                            onClick={handleSelectModel}
                            disabled={!send}
                            size="small"
                        >
                            Select Model
                        </CustomButton>
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Box>
    );
}
