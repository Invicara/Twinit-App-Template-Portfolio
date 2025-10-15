import React, { useEffect, useState, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import EngineeringChangesTab from "./EngineeringChangesTab";
import SiteEquipmentTab from "./SiteEquipmentTab";
import { engineeringChangesService } from "../../../services/engineeringChanges";
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

  //TODO use real facility/site id

  const { selectedModelComposite, refreshECTrigger } = useContext(ModelContext);

const modelName = selectedModelComposite?._name || '';

const match = modelName.match(/^Facility-([A-Z]+)_Unit-(\d{2})$/i);

const facilityId = match ? match[1].toUpperCase() : null;
const buildingId = match ? match[2] : null;


  useEffect(() => {
    if (!selectedModelComposite || !buildingId) {
      setECs([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true); 
      setECs(null); 

      try {
        const result = await engineeringChangesService({ buildingId, facilityId });
        setECs(result || []);
      } catch (err) {
        console.error("Failed to fetch ECS:", err);
        setECs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedModelComposite, buildingId,  refreshECTrigger]);

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
        {tab === 1 && <SiteEquipmentTab className={classes.tab} levelData={levelData} loadingLevelData={loadingLevelData} hasFetched={hasFetched} data={ECs} facilityId={facilityId} buildingId={buildingId} />}
      </div>
    </Box>
  );
}
