import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Collapse,
  IconButton,
  FormControl,
  Select,
  MenuItem,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';

const useStyles = makeStyles((theme) => ({
  filterBox: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  formControl: {
    minWidth: 120,
  },
  renderValue: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0px',
    marginLeft: 30,
    color: theme.palette.text.secondary,
  },
  arrow: {
    marginLeft: theme.spacing(1),
  },
  card: {
    marginBottom: theme.spacing(2),
    borderRadius: 4,
    backgroundColor: '#EBEBEB',
    fontFamily: 'Inter, sans-serif',
  },
  expandIcon: {
    marginLeft: 'auto',
  },
    row: {
    display: 'flex',
    alignItems: 'center',
    padding: '2px 0',
  },
  bodyText: {
    flex: '0 0 200px', // fixed width for Equipment Id column
    fontWeight: 500,
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    marginBottom: 2,
  },
  title: {
    fontWeight: 700,
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    marginBottom: theme.spacing(1),
  },
  chipSmall: {
    height: 18,
    fontSize: 12,
    textTransform: 'uppercase',
    border: '1px solid #ccc',
    backgroundColor: 'transparent',
    '& .MuiChip-label': {
      paddingLeft: theme.spacing(0.5),
      paddingRight: theme.spacing(0.5),
      fontSize: 12,
    },
  },
}));

// Text-only colors
const statusConfig = { 
  APPROVED: { 
    bg: '#D1E7D1', 
    text: '#1A8817', 
    label: 'Approved' 
  },
  REGISTERED: { 
    bg: '#E6C7F0', 
    text: '#8E11BA', 
    label: 'Registered' 
  },
  CLOSED: { 
    bg: '#DCDCDC', 
    text: '#5D5D5D', 
    label: 'Closed' 
  },
};

const filterOptions = ['All', ...Object.keys(statusConfig)];

export default function EngineeringChangesTab({ data }) {

  console.log('ec data', data);
  const classes = useStyles();
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState({});

  const handleExpandClick = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };


    const handleCardClick = (ec) => {
    console.log('Clicked card:', ec); 

    // setSelectedCard(ec);
  };

  const filterByLabel =
    filter === 'All' ? 'Filter by' : `Filter by (${filter})`;

  const filteredData =
  !data || data.length === 0
    ? []
    : filter === 'All'
    ? data
    : data.filter((ec) => {
        if (!ec.status) return false;
        switch (filter) {
          case 'APPROVED':
            return ec.status.APPROVED > 0;
          case 'CLOSED':
            return ec.status.CLOSED > 0;
          case 'REGISTERED':
            return ec.status.REGISTERED > 0;
          default:
            return true;
        }
      });

  // helper to split camelCase or PascalCase
  const formatFieldName = (name) =>
    name.replace(/([a-z])([A-Z])/g, '$1 $2');

  return (
    <Box>
      {/* Filter dropdown */}
      <Box className={classes.filterBox}>
        <FormControl className={classes.formControl}>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            displayEmpty
            disableUnderline
            renderValue={() => (
              <div className={classes.renderValue}>
                <span>{filterByLabel}</span>
                <KeyboardArrowDownIcon className={classes.arrow} />
              </div>
            )}
          >
            {filterOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Cards */}
            {filteredData.map((ec, index) => {
              const orderedFields = [
                'Base Revision',
                  'Equipment Revision',
                  'EC Type',
                  'EC ID',          
                  'Date Reviewed',  
              ];

              return (
              <Card
        key={index}
        className={classes.card}
        onClick={() => handleCardClick(ec)} // 👈 click anywhere selects card
        style={{ cursor: 'pointer' }}
      >
      <CardContent>
        {/* Status chips + expand */}
        <Box display="flex" alignItems="center" marginBottom={1}>
          {Object.entries(ec.status || {}).map(([status, count]) => {
            return (
              <Chip
                key={status}
                label={`${status} ${count}`}
                className={classes.chipSmall}
                style={{
                  backgroundColor: statusConfig[status]?.bg || '#EBEBEB',
                  color: statusConfig[status]?.text || '#000',
                  marginRight: 4,
                }}
                size="small"
              />
            );
          })}
          <IconButton
            className={classes.expandIcon}
            onClick={(e) => {
              e.stopPropagation(); // prevent triggering handleCardClick
              handleExpandClick(index);
            }}
            size="small"
          >
            {expanded[index] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </Box>

        {/* EC Title */}
        <Typography className={classes.title}>
          {ec['EC Title']}
        </Typography>

        {/* Ordered fields */}
        {orderedFields.map((field) => {
          const value = ec[field] || '-';
          return (
            <Typography key={field} className={classes.bodyText}>
              <strong>{formatFieldName(field)}:</strong> {value}
            </Typography>
          );
        })}
      </CardContent>

            {/* Expandable logs list */}
        <Collapse in={expanded[index]} timeout='auto' unmountOnExit>
            <CardContent>
              {(() => {
                let logsArray = [];

                if (Array.isArray(ec.logs)) {
                  logsArray = ec.logs.map((log, i) => ({
                    name: log['Equipment Id'] || `Log ${i + 1}`,
                    ...log,
                  }));
                } else if (ec.logs && typeof ec.logs === 'object') {
                  logsArray = Object.entries(ec.logs).map(([key, details]) => ({
                    name: details['Equipment Id'] || key,
                    ...details,
                  }));
                }

                return logsArray.map((log, logIdx) => (
                  <Box key={logIdx} mb={1} pb={1} borderBottom="1px solid #e0e0e0">
                    {/* Label */}
                    <Typography
                      variant="caption"
                      style={{ color: '#777', fontSize: 12, marginBottom: 2 }}
                    >
                      Name id
                    </Typography>

                    {/* Value + Chip */}
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography className={classes.bodyText}>
                        {log.name}
                      </Typography>
                      <Chip
                        label={log.status || 'Unknown'}
                        className={classes.chipSmall}
                        style={{
                          backgroundColor: statusConfig[log.status]?.bg || '#EBEBEB',
                          color: statusConfig[log.status]?.text || '#000',
                        }}
                        size="small"
                      />
                    </Box>
                  </Box>
                ));
              })()}
            </CardContent>
          </Collapse>
          </Card>
        );
      })}
    </Box>
  );
}
