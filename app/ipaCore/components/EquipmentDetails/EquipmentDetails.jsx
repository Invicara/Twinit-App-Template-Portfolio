import React, { useEffect, useState, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import SiteEquipmentTab from "./SiteEquipmentTab";
import { ModelContext } from "../../contexts/ModelContext";
import { useTreeData } from '../../contexts/TreeContext';

const useStyles = makeStyles((theme) => ({
  root: {
    minWidth: 150,
    backdropFilter: "blur(5px)",
  },
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    minWidth: 0,
    whiteSpace: "nowrap",
    textTransform: "none",
    fontSize: 13,
  },
  tabPanel: {
    padding: theme.spacing(2),
  },
}));

export default function EquipmentDetails() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);

  const [loading, setLoading] = useState(false);

  const handleChange = (event, newValue) => {
    setTab(newValue);
  };

  //TODO use real facility/site id

  const { selectedModelComposite } = useContext(ModelContext);

  const modelName = selectedModelComposite?._name || '';

  const match = modelName.match(/^Facility-([A-Z]+)_Unit-(\d{2})$/i);

  const facilityId = match ? match[1].toUpperCase() : null;
  const buildingId = match ? match[2] : null;


  const [levelData, setLevelData] = useState()
  const [loadingLevelData, setLoadingLevelData] = useState(false)
  const [hasFetched, setHasFetched] = useState(false);

  const { fetchTreeData } = useTreeData();

  useEffect(() => {
    const run = async () => {
    try {
        setLoadingLevelData(true)
        const treeLevelData = await fetchTreeData(facilityId, buildingId)
        setLevelData(treeLevelData)
    } catch (err) {
        console.error("Failed to fetch Tree Level Data:", err)
    } finally {
        setLoadingLevelData(false)
        setHasFetched(true)
    }
    };
    run();
  }, [fetchTreeData, buildingId])


  return (
    <Box>
      {/* Tabs Header */}
      <Tabs
        value={tab}
        onChange={handleChange}
        indicatorColor="primary"
        textColor="primary"
        className={classes.tabs}
        variant="standard"
      >
        <Tab label="Site Equipment" />
      </Tabs>

      {/* Tab Panels */}
      <div>
        <SiteEquipmentTab className={classes.tab} levelData={levelData} loadingLevelData={loadingLevelData} hasFetched={hasFetched} facilityId={facilityId} buildingId={buildingId} />
      </div>
    </Box>
  );
}