import React, { useEffect, useState, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import EngineeringChangesTab from "./EngineeringChangesTab";
import SiteEquipmentTab from "./SiteEquipmentTab";
import { engineeringChangesAPIs } from "../../../services/engineeringChanges";
import { MapMachineContext } from "../../pageComponents/portfolioOverview/PortfolioOverview";
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

  const [ECs, setECs] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (event, newValue) => {
    setTab(newValue);
  };

  const { selectedModelComposite } = useContext(ModelContext);

  const match = selectedModelComposite?._name?.match(/_(\d+)$/);
  const buildingId = match ? match[1].slice(-2) : null;
  const facilityId = buildingId == '01' ? 'A' : 'B';

  useEffect(() => {
    if (!selectedModelComposite || !buildingId) {
      setECs([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true); 
      setECs(null); 

      try {
        const result = await engineeringChangesAPIs({ buildingId, facilityId });
        setECs(result || []);
      } catch (err) {
        console.error("Failed to fetch ECS:", err);
        setECs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedModelComposite, buildingId]);

    const [levelData, setLevelData] = useState()
    const [loadingLevelData, setLoadingLevelData] = useState(false)

    const { fetchTreeData } = useTreeData();

    useEffect(() => {
        const run = async () => {
          setLoadingLevelData(true)
            const treeLevelData = await fetchTreeData(facilityId, buildingId);
            setLevelData(treeLevelData)
            setLoadingLevelData(false)
        }
        run()
    }, [fetchTreeData, buildingId]);

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
        <Tab label="Engineering Changes" />
        <Tab label="Site Equipment" />
      </Tabs>

      {/* Tab Panels */}
      <div>
        {tab === 0 && (
          <EngineeringChangesTab
            data={ECs}
            loading={loading}
            buildingId={buildingId}
            className={classes.tab}
          />
        )}
        {tab === 1 && <SiteEquipmentTab className={classes.tab} levelData={levelData} loadingLevelData={loadingLevelData} />}
      </div>
    </Box>
  );
}
