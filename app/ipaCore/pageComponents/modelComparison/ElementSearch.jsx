import React, { useState } from "react";

import ModelProperties from "./ModelProperties";
import ModelQuery from "./ModelQuery";

const ElementSearch = ({ modelOne, modelTwo, setModelOneSliceIDs, setModelTwoSliceIDs }) => {
    const [selectedPropRefs, setSelectedPropRefs] = useState([]);

    return (
        <>
            <ModelProperties
                modelOne={modelOne}
                modelTwo={modelTwo}
                selectedPropRefs={selectedPropRefs}
                setSelectedPropRefs={setSelectedPropRefs}
            />
            <ModelQuery
                modelOne={modelOne}
                modelTwo={modelTwo}
                selectedPropRefs={selectedPropRefs}
                setModelOneSliceIDs={setModelOneSliceIDs}
                setModelTwoSliceIDs={setModelTwoSliceIDs}
            />
        </>
    );
};

export default ElementSearch;
