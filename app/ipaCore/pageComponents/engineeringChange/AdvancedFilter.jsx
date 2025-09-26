import React, { useState } from "react";
import {
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from "@mui/material";

const AdvancedFilter = ({ openFilter, setOpenFilter }) => {
    return (
        <>
            <Dialog open={openFilter} onClose={() => setOpenFilter(false)}>
                <DialogTitle>Advanced Filters</DialogTitle>
                <DialogContent>
                    <p>Filter options</p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenFilter(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default AdvancedFilter;
