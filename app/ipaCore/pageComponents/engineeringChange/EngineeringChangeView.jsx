import React, { useEffect, useState } from "react";
import EngineeringChangeList from "./EngineeringChangeList";
import ecData from "./data/ecData.json"
import AdvancedFilter from "./AdvanceFilter";
import {
  Button,
  TextField,
  Typography,
  InputAdornment
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

const EngineeringChangeView = () => {
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [openFilter, setOpenFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const getEcData = (ecData) => {
    return ecData.flatMap((ec) =>
      Object.entries(ec.logs).map(([logKey, logValue]) => ({
        id: ec.id,
        title: ec.title,
        type: ec.type,
        logKey,
        baseRevision: logValue["Base Revision"],
        equipmentRevision: logValue["Equipment Revision"],
        dateImplemented: logValue.dateImplemented,
        dateProposed: logValue.dateProposed,
        dateReviewed: logValue.dateReviewed,
        status: logValue.status,
        statusSummary: ec.status,
      }))
    );
  };

  useEffect(() => {
    const processed = getEcData(ecData.ecs);
    setRows(processed);
    setFilteredRows(processed);
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (!value) {
      setFilteredRows(rows);
      return;
    }
    const result = rows.filter((row) =>
      row.title.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredRows(result);
  };

  const handleClose = () => setOpenFilter(false);

  return (
    <div style={{ padding: '15px' }}>
      <Typography variant="h5" gutterBottom>Engineering Changes</Typography>
      <div style={{ display: "flex", marginBottom: "1rem" }}>
        <TextField
          label="Search EC Title"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={handleSearchChange}
          style={{ width: "25%", marginRight: "10px" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button startIcon={<FilterListIcon />}  variant="outlined" onClick={() => setOpenFilter(true)}>Advance Filter</Button>
      </div>
      <EngineeringChangeList rows={filteredRows} />
      <AdvancedFilter openFilter={openFilter} handleClose={handleClose} />
    </div>
  )
};

export default EngineeringChangeView;
