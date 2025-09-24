import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import CardContent from '@material-ui/core/CardContent';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';

import EngineeringChangesTab from './EngineeringChangesTab';
import SiteEquipmentTab from './SiteEquipmentTab';

const useStyles = makeStyles((theme) => ({
  root: {
    minWidth: 150,
    backdropFilter: 'blur(5px)',
  },
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    minWidth: 0,             // prevent Material-UI from forcing a wide min-width
    whiteSpace: 'nowrap',    // prevent wrapping
    textTransform: 'none',   // optional: keep capitalization as-is
  },
  tabPanel: {
    padding: theme.spacing(2),
  },
}));

export default function EquipmentDetails() {
  const classes = useStyles();
  const [tab, setTab] = React.useState(0);

  const handleChange = (event, newValue) => {
    setTab(newValue);
  };

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
        {tab === 0 && <EngineeringChangesTab className={classes.tab} />}
        {tab === 1 && <SiteEquipmentTab className={classes.tab} />}
      </div>
    </Box>
  );
}
