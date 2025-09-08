import React, { useState, useEffect } from 'react';
import {
  Grid,
  Button,
  Paper,
  Box,
  MenuItem,
  TextField,
  Select,
  Typography,
  InputAdornment,
  FormControl,
  makeStyles
} from '@material-ui/core';
import clsx from 'clsx';
import SearchIcon from '@material-ui/icons/Search';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import DeployStatusChart from './DeployStatusBarChart';

const useStyles = makeStyles((theme) => ({
    sidebarPaper: {
        width: 580,
        maxHeight: '100vh',   
        overflowY: 'auto',   
        flexShrink: 0,
        '& .MuiSelect-outlined.MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',      
            height: '100%',
            padding: '0',                 
        },
      },
      formControl: {
        width: 258,
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
}));

export default function SearchPanel({ currentState, context, userConfig }) {
  const classes = useStyles();

 const [labels, setLabels] = useState({
    search: 'Search',
    group: 'Group',
    structure: 'Choose structure name / location',
    location: 'Choose locations / regions',
    status: 'Status'
  })

  useEffect(() => {
    if (userConfig?.handlers?.portfolioOverview?.config?.labels) {
      const {
        search = 'Search',
        group = 'Group',
        structure = 'Choose structure name / location',
        location = 'Choose locations / regions',
        status = 'Status'
      } = userConfig.handlers.portfolioOverview.config.labels

      setLabels({ search, group, structure, location, status })
    }
  }, [userConfig]) 

  const [filters, setFilters] = useState({
    search: '',
    group: '',
    structure: '',
    location: '',
    status: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Search filters:', filters);
  };

  return (
    <Paper elevation={3} className={clsx(classes.sidebarPaper)}>
      <Box display='flex' justifyContent='center' p={4}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body1" className={classes.label}>Search</Typography>
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

            <Grid item>
              <Typography variant="body1" className={classes.label}>{labels.group}</Typography>
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
                      return <span className={classes.placeholder}>Choose</span>;
                    }
                    return selected;
                  }}
                >
                {/* TODO: hook real data into the menu items selection */}
                  <MenuItem value="group1">Group 1</MenuItem>
                  <MenuItem value="group2">Group 2</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item>
              <Typography variant="body1" className={classes.label}>{labels.structure}</Typography>
              <FormControl
                variant="outlined"
                className={classes.formControl}
              >
                <Select
                  name="structure"
                  value={filters.structure}
                  onChange={handleChange}
                  displayEmpty
                  IconComponent={KeyboardArrowDownIcon} 
                  renderValue={(selected) => {
                    if (!selected) {
                      return <span className={classes.placeholder}>Choose</span>;
                    }
                    return selected;
                  }}
                  classes={{ root: classes.selectInput }}
                >
                {/* TODO: hook real data into the menu items selection */}
                  <MenuItem value="structureA">Structure A</MenuItem>
                  <MenuItem value="structureB">Structure B</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item>
              <Typography variant="body1" className={classes.label}>{labels.location}</Typography>
              <FormControl
                variant="outlined"
                className={classes.formControl}
              >
                <Select
                  name="location"
                  value={filters.location}
                  onChange={handleChange}
                  displayEmpty
                  IconComponent={KeyboardArrowDownIcon} 
                  renderValue={(selected) => {
                    if (!selected) {
                      return <span className={classes.placeholder}>Choose</span>;
                    }
                    return selected;
                  }}
                  classes={{ root: classes.selectInput }}
                >
                {/* TODO: hook real data into the menu items selection */}
                  <MenuItem value="location1">Location 1</MenuItem>
                  <MenuItem value="location2">Location 2</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item>
              <Typography variant="body1" className={classes.label}>{labels.status}</Typography>
              <FormControl
                variant="outlined"
                className={classes.formControl}
              >
                <Select
                  name="deployStatus"
                  value={filters.status}
                  onChange={handleChange}
                  displayEmpty
                  IconComponent={KeyboardArrowDownIcon} 
                  renderValue={(selected) => {
                    if (!selected) {
                      return <span className={classes.placeholder}>Choose</span>;
                    }
                    return selected;
                  }}
                  classes={{ root: classes.selectInput }}
                >
                {/* TODO: hook real data into the menu items selection */}
                  <MenuItem value="deployed">Deployed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>

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
      <Box className={classes.divider} />
      <DeployStatusChart />
    </Paper>
  );
};


