import React from 'react';
import {
  Typography,
  makeStyles
} from '@material-ui/core';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';


const useStyles = makeStyles((theme) => ({
  root: {
    maxWidth: 400,
    border: '1px solid #e0e0e0', // Light grey border
    borderRadius: '8px',        // Rounded corners
    boxShadow: 'none',          // Remove default shadow
  },
  chip: {
    backgroundColor: '#d9f0d9',   // Light green background
    color: '#1a7e1a',             // Dark green text
    fontWeight: 'bold',
    fontSize: '0.8rem',
    marginBottom: theme.spacing(2), // Spacing below the chip
  },
}));

const ChangeList = () => {
  const classes = useStyles();

  return (
   
        <Card className={classes.root}>
          <CardContent>
            <Chip label="Approved" className={classes.chip} />

            <Typography variant="h6" className={classes.title}>
              EC Title: Adjusted flow rate by +100 gpm
            </Typography>

            <Typography variant="body2" className={classes.detail}>
              Base Revision: 000
            </Typography>
            <Typography variant="body2" className={classes.detail}>
              Revision: 000A
            </Typography>
            <Typography variant="body2" className={classes.detail}>
              EC Type: Technical Parameters
            </Typography>
            <Typography variant="body2" className={classes.detail}>
              EC ID: 001
            </Typography>
            <Typography variant="body2" className={classes.detail}>
              Date Reviewed: 25/08/2010
            </Typography>
          </CardContent>
        </Card>
      
  );
};

export default ChangeList;