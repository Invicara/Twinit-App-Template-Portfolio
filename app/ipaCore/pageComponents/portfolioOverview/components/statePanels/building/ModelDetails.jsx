import React, {useContext} from "react";
import {InfoComponent} from "../../../../../components/InfoComponent/InfoComponent.jsx";
import {ModelContext} from "../../../../../contexts/ModelContext.js";

const modelSchema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "title": "Model",
    "required": [
        "modelName",
        "_name",
        "_tipVersion"
    ],
    "properties": {
        "modelName": {
            "type": "string",
            "readOnly": true,
            "title": "Model Name",
            "description": "The name of the model",
            "propertyOrder": 1
        },
        "_tipVersion": {
            "type": "string",
            "readOnly": true,
            "title": "Model Version",
            "description": "The version number of the model",
            "propertyOrder": 2
        }
    }
}

export default function ModelDetails() {

    const { selectedModelComposite, setSelectedModelComposite, selectedModelCompositeVersions, selectedModelCompositeVersion, setSelectedModelCompositeVersion, availableModelComposites } = useContext(ModelContext)

    return <InfoComponent
        entity={selectedModelComposite}
        type={modelSchema}
        originalEntity={selectedModelComposite}
        disabled={true}
    />

}
