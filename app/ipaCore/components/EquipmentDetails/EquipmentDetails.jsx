import React, { useEffect, useState, useContext } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import CardContent from '@material-ui/core/CardContent';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';

import EngineeringChangesTab from './EngineeringChangesTab';
import SiteEquipmentTab from './SiteEquipmentTab';
import { engineeringChangesAPIs } from '../../../services/engineeringChanges';
import { MapMachineContext } from '../../pageComponents/portfolioOverview/PortfolioOverview';
import { useActor, useSelector as useXstateSelector, useMachine } from '@xstate/react';

const useStyles = makeStyles((theme) => ({
  root: {
    minWidth: 150,
    backdropFilter: 'blur(5px)',
  },
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    minWidth: 0,            
    whiteSpace: 'nowrap',    
    textTransform: 'none',   
  },
  tabPanel: {
    padding: theme.spacing(2),
  },
}));

export default function EquipmentDetails() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);

  const [ECs, setECs] = useState(null);
  const handleChange = (event, newValue) => {
    setTab(newValue);
  };

        const { send, actor } = useContext(MapMachineContext);
        const currentState = useXstateSelector(actor, state => state);
    
        const context = currentState?.context ?? {};
  
        console.log('EC2 currentState', currentState);
  

    useEffect(() => {
          const run = async () => {
              const result = await engineeringChangesAPIs();

              setECs(result);
              console.log('engineeringchangesresult', result);

          };
          run();
      }, []);

  return (
    <Box>
      {/* Tabs Header */}
      <Tabs
        value={tab}
        onChange={handleChange}
        indicatorColor="primary"
        textColor="primary"
        className={classes.tabs}
        variant="fullWidth"
      >
        <Tab label="Engineering Changes" />
        <Tab label="Site Equipment" />
      </Tabs>

      {/* Tab Panels */}
      <div>
        {tab === 0 && <EngineeringChangesTab data={ECs} className={classes.tab} />}
        {tab === 1 && <SiteEquipmentTab className={classes.tab} />}
      </div>
    </Box>
  );
}
