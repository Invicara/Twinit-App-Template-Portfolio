import React, { useState, useEffect } from 'react';
import {
  Grid,
  Button,
  Box,
  MenuItem,
  TextField,
  Select,
  Typography,
  InputAdornment,
  FormControl,
  makeStyles
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
// import Card from '@material-ui/core/Card';
// import CardContent from '@material-ui/core/CardContent';
// import Chip from '@material-ui/core/Chip';


const useStyles = makeStyles((theme) => ({
  formControl: {
    width: 532,
    paddingBottom: 8,
    '& .MuiOutlinedInput-root': {
      height: 36,
      borderRadius: 4,
      '& .MuiSelect-select': {
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        boxSizing: 'border-box',
      },
    },
  },
  placeholder: {
    color: '#B8B8B8',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    marginTop: 5
  },
  textField: {
    width: 532,
    paddingBottom: 8,
    '& input::placeholder': {
      color: '#B8B8B8',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 400,
      fontSize: '14px',
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: 4,
      '& input': {
        height: 36,
        padding: 0,
        color: '#000000',
      },
    },
  },
  label: {
    color: '#1D1D1D',
    fontWeight: 500,
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    lineHeight: '19px',
    display: 'block',
    paddingTop: 5
  },
  inputText: {
    color: '#B8B8B8',
    transform: 'translate(0px, 1.5px)',
  },
  searchIcon: {
    width: 16,
    height: 16,
    position: 'relative',
    top: 2.67,
    left: 2.67,
    transform: 'rotate(0deg)',
    opacity: 1,
    color: '#5D5D5D',
  },
  divider: {
    border: 'none',
    height: '1px',
    borderTop: '1px solid #EBEBEB',
    marginBottom: 24,
    width: 532,
    marginTop: 0,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
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
  title: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(1.5),
  },
  detail: {
    color: theme.palette.text.secondary,
    lineHeight: 1.5, // Spacing between lines
  },
}));

export default function EngineeringChangeView({ currentState, context, userConfig }) {
  const classes = useStyles();
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Search filters:', filters);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const [filters, setFilters] = useState({
    search: '',
    group: '',
  });

  const [labels, setLabels] = useState({
    search: 'Search',
    group: 'Group',
  })

  return (
    <div>
      <Box display='flex' justifyContent='left' pt={4} pl={4}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body1" className={classes.label}>Search Input</Typography>
              <TextField
                fullWidth
                variant="outlined"
                name="search"
                placeholder={labels.search}
                value={filters.search}
                onChange={handleChange}
                className={classes.textField}
                InputProps={{
                  classes: { input: classes.inputText },
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon className={classes.searchIcon} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body1" className={classes.label}>Filter</Typography>
              <FormControl
                variant="outlined"
                className={classes.formControl}
              >
                <Select
                  name="group"
                  value={filters.group}
                  onChange={handleChange}
                  displayEmpty
                  IconComponent={KeyboardArrowDownIcon}
                  renderValue={(selected) => {
                    if (!selected) {
                      return <span className={classes.placeholder}>Filter by</span>;
                    }
                    return selected;
                  }}
                >
                  {/* TODO: hook real data into the menu items selection */}
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="registered">Registered</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <br />
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={true}
              >
                Search
              </Button>
            </Grid>
            
          </Grid>
        </form>
      </Box>
    
      {/* <Box display='flex' justifyContent='left' pt={4} pl={4}>
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
      </Box> */}
    </div>
  );
}
