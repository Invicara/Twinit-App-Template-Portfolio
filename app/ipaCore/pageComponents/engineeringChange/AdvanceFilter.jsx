import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  MenuItem,
} from "@mui/material";

const AdvancedFilter = ({ open, onClose, onApply }) => {
  const [filters, setFilters] = useState({
    status: "",
    baseRevision: "",
    equipmentRevision: "",
    ecType: "",
    ecId: "",
    dateProposed: "",
    dateImplemented: "",
    dateReviewed: "",
  });

  const handleChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleCancel = () => {
    setFilters({
      status: "",
      baseRevision: "",
      equipmentRevision: "",
      ecType: "",
      ecId: "",
      dateProposed: "",
      dateImplemented: "",
      dateReviewed: "",
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Ticket</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <TextField
              select
              fullWidth
              label="Status"
              value={filters.status}
              onChange={(e) => handleChange("status", e.target.value)}
            >
              <MenuItem value="APPROVED">APPROVED</MenuItem>
              <MenuItem value="REGISTERED">REGISTERED</MenuItem>
              <MenuItem value="CLOSED">CLOSED</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Base Revision"
              fullWidth
              value={filters.baseRevision}
              onChange={(e) => handleChange("baseRevision", e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Revision"
              fullWidth
              value={filters.equipmentRevision}
              onChange={(e) => handleChange("equipmentRevision", e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="EC Type"
              fullWidth
              value={filters.ecType}
              onChange={(e) => handleChange("ecType", e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="EC ID"
              fullWidth
              value={filters.ecId}
              onChange={(e) => handleChange("ecId", e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Date Proposed"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.dateProposed}
              onChange={(e) => handleChange("dateProposed", e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Date Reviewed"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.dateReviewed}
              onChange={(e) => handleChange("dateReviewed", e.target.value)}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Date Implemented"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.dateImplemented}
              onChange={(e) => handleChange("dateImplemented", e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="inherit">Cancel</Button>
        <Button onClick={handleApply} variant="contained" color="primary">Filter Now</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdvancedFilter;

