import React, {useContext, useMemo} from "react";
import {InfoComponent} from "../../../../../components/InfoComponent/InfoComponent.jsx";
import {ModelContext} from "../../../../../contexts/ModelContext.js";
import {Box} from "@material-ui/core";
import CustomButton from "../../../../../components/atoms/CustomButton.jsx";
import {Add} from "@material-ui/icons";

const modelSchema = {
    "type": "object",
    "title": "Model",
    "required": [
        "_source",
        "_name",
        "_description",
        "_tipVersion"
    ],
    "properties": {
        "_name": {
            "type": "string",
            "readOnly": true,
            "title": "Model Name",
            "description": "The name of the model",
            "propertyOrder": 1
        },
        "_description": {
            "type": "string",
            "readOnly": true,
            "title": "Model Description",
            "description": "The description of the model",
            "propertyOrder": 2
        },
        "_tipVersion": {
            "type": "string",
            "readOnly": true,
            "title": "Model Version",
            "description": "The version number of the model",
            "propertyOrder": 3
        },
        "_source": {
            "type": "string",
            "readOnly": true,
            "title": "Source",
            "description": "The source of the model",
            "propertyOrder": 4
        }
    }
}

export default function ModelDetails({selectedModelComposite}) {

    const modelDetails = useMemo(()=>{
        return {
            ...selectedModelComposite,
            _source: selectedModelComposite?._versions?.[0]?._userAttributes?.model?.source // TODO: filter them out
        }
    },[selectedModelComposite])

    return <Box p={2}>
            <InfoComponent
                entity={modelDetails}
                type={modelSchema}
                originalEntity={modelDetails}
                disabled={true}
            />
        </Box>

}
