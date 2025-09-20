import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectIsSelectingPosition, setDraftType, setIsSelectingPosition, setSelectedCoordinate } from "../../../../redux/siteSetup";
import { PinDrop } from '@material-ui/icons';
import { Tooltip } from "@material-ui/core";


const AddSiteSection = ({classes, levels}) => {
    const dispatch = useDispatch();

    const isSelectingPosition = useSelector(selectIsSelectingPosition);
    
    const handleAddSite = () => {
        dispatch(setSelectedCoordinate());
        dispatch(setIsSelectingPosition(!isSelectingPosition));
        dispatch(setDraftType(!isSelectingPosition ? "site" : undefined))
    };


    return <div className={isSelectingPosition ? classes.addSiteSectionActive : classes.addSiteSection} onClick={handleAddSite} >
        <Tooltip title="Add Site">
            <PinDrop/>
        </Tooltip>
    </div>
}

export default AddSiteSection;
