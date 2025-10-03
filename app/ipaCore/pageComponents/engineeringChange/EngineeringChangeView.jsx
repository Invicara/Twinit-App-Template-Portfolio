import React, { useEffect, useState } from "react";
import EngineeringChangeList from "./EngineeringChangeList";
import AdvancedFilter from "./AdvanceFilter";
import {
  Button,
  TextField,
  Typography,
  InputAdornment
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import Refresh from '@mui/icons-material/Refresh';
import { formatDateOnly } from './common/utility.js';
import { IafProj, IafSession } from "@dtplatform/platform-api";

const EngineeringChangeView = () => {
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [openFilter, setOpenFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchEngineeringChangeData = async () => {
    try {
      const ctx = IafProj.getCurrent();
      const omapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}/engineeringchanges`;

      let response = await fetch(omapiUrl, {
        method: "GET",
        mode: "cors",
        headers: {
          Authorization: "Bearer " + IafSession.getAuthToken(ctx),
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch engineering change data:", error.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  const getEcData = (ecData) => {
    return ecData?.flatMap((ec) =>
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
    (async () => {
      try {
        const engineeringData = await fetchEngineeringChangeData();
        const dataToProcess = engineeringData?._result?.ecs || [];
        const processed = getEcData(dataToProcess);
        setRows(processed);
        setFilteredRows(processed);
      } catch (error) {
        console.error("Failed to load engineering data:", error);
        setRows([]);
        setFilteredRows([]);
      }
    })();
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

  const handleReset = () => {
    setSearchQuery("");
    setFilteredRows(rows);
  };

  const handleFilterApply = (filters) => {
    const fieldMap = {
      status: (row, value) => row.status?.toLowerCase().includes(value.toLowerCase()),
      ecType: (row, value) =>
        row.type?.toLowerCase().includes(value.toLowerCase()),
      ecId: (row, value) =>
        row.id?.toLowerCase().includes(value.toLowerCase()),
      baseRevision: (row, value) =>
        row.baseRevision?.toLowerCase().includes(value.toLowerCase()),
      equipmentRevision: (row, value) =>
        row.equipmentRevision?.toLowerCase().includes(value.toLowerCase()),
      dateProposed: (row, value) =>
        formatDateOnly(row.dateProposed).includes(formatDateOnly(value)),
      dateReviewed: (row, value) =>
        formatDateOnly(row.dateReviewed).includes(formatDateOnly(value)),
      dateImplemented: (row, value) =>
        formatDateOnly(row.dateImplemented).includes(formatDateOnly(value)),
    };

    setFilteredRows(
      rows.filter((row) =>
        Object.entries(filters).every(
          ([key, value]) => !value || fieldMap[key]?.(row, value)
        )
      )
    );
  };

  return (
    <div style={{ padding: '15px' }}>
      {isLoading ? (
        <div style={{ padding: '25px', textAlign: 'center' }}>
          <p>Loading Engineering Changes Data...</p>
        </div>
      ) : (
        <>
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
            <Button startIcon={<FilterListIcon />} variant="outlined" onClick={() => setOpenFilter(true)}>Advance Filter</Button>&nbsp;
            <Button startIcon={<Refresh />} variant="outlined" color="secondary" onClick={handleReset}>Reset</Button>
          </div>
          <EngineeringChangeList rows={filteredRows} />
          <AdvancedFilter open={openFilter} onClose={handleClose} onApply={handleFilterApply} />
        </>
      )}
    </div>
  )
};

export default EngineeringChangeView;
