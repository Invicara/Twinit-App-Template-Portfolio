import React, { useEffect, useState } from "react";
import EngineeringChangeList from "./EngineeringChangeList";
import ecData from "./data/ecData.json"
import AdvancedFilter from "./AdvanceFilter";
import {
  Button,
  TextField,
  Typography
} from "@mui/material";

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

  return (
    <div style={{ height: 820, overflowY: 'scroll', padding: '15px' }}>
      <Typography variant="h4" gutterBottom>Engineering Changes</Typography>
      <div style={{ display: "flex", marginBottom: "1rem" }}>
        <TextField
          label="Search EC Title"
          variant="outlined"
          // size="small"
          value={searchQuery}
          onChange={handleSearchChange}
          style={{ width: "25%", marginRight: "10px" }}
        />
        <Button variant="outlined" onClick={() => setOpenFilter(true)}>Advance Filter</Button>
      </div>
      <EngineeringChangeList rows={filteredRows} />
      <AdvancedFilter openFilter={openFilter} setOpenFilter={setOpenFilter} />
    </div>
  )
};

export default EngineeringChangeView;
