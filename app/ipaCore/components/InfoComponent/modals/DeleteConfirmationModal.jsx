import {Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography} from "@mui/material";
import React from "react";

export function DeleteConfirmationModal({deleteModalOpen, currentField, handleDeleteConfirm, handleModalClose}) {
    return <Dialog open={deleteModalOpen} onClose={handleModalClose} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Property</DialogTitle>
        <DialogContent>
            <Typography>
                Are you sure you want to remove the property <strong>"{currentField}"</strong>?
                This action cannot be undone.
            </Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={handleModalClose} color="primary">
                Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} color="secondary" variant="contained">
                Delete
            </Button>
        </DialogActions>
    </Dialog>
}
