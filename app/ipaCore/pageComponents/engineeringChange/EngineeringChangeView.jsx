import React, { useEffect, useState } from "react";
import EngineeringChangeList from "./EngineeringChangeList";
import ecData from "./data/ecData.json"

const EngineeringChangeView = () => {
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);

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
    console.log("processed", processed)
    setRows(processed);
    setFilteredRows(processed);
  }, []);

   const handleSearch = (query) => {
    if (!query) {
      setFilteredRows(rows);
      return;
    }
    const result = rows.filter((row) =>
      row.title.toLowerCase().includes(query.toLowerCase())
    );
      console.log("result", result)
    setFilteredRows(result);
  };

  return <EngineeringChangeList rows={filteredRows} onSearch={handleSearch} />;
};

export default EngineeringChangeView;
