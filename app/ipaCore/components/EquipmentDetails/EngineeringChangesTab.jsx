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
    justifyContent: 'space-between',
    padding: '2px 0',
  },
  title: {
    fontWeight: 700,
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    marginBottom: theme.spacing(1),
  },
  bodyText: {
    fontWeight: 500,
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    marginBottom: 2,
  },
}));

const statusConfig = {
  APPROVED: { color: '#4caf50', label: 'Approved' },
  REGISTERED: { color: '#9c27b0', label: 'Registered' },
  CLOSED: { color: '#9e9e9e', label: 'Closed' },
};

const filterOptions = [
  'All',
  ...Object.keys(statusConfig).map((s) => `Only ${statusConfig[s].label}`),
  ...Object.keys(statusConfig).map((s) => `Includes ${statusConfig[s].label}`),
];

const engineeringChangesData = [
  {
    'EC ID': '001',
    AffectedEquipIDs:
      'RCP-A-011; RCP-A-012; RCP-A-013; RCP-A-014; RCP-A-021; RCP-A-022; RCP-A-023; RCP-A-024',
    'EC Status': 'APPROVED',
    DateProposed: '18/07/2010',
    DateReviewed: '25/08/2010',
    DateImplemented: '',
    'Base Revision': '000',
    Revision: '000A',
    'EC Type': 'Technical Parameters',
    'EC Title': 'Adjusted flow rate by +100 gpm',
  },
  {
    'EC ID': '002',
    AffectedEquipIDs: 'RCP-A-023',
    'EC Status': 'REGISTERED',
    DateProposed: '20/04/2019',
    DateReviewed: '',
    DateImplemented: '',
    'Base Revision': '001',
    Revision: '001A',
    'EC Type': 'Equipment Change/Redesign',
    'EC Title': 'Replace RCP with KSB RSR Model',
  },
  {
    'EC ID': '005',
    AffectedEquipIDs: 'RCP-B-011',
    'EC Status': 'CLOSED',
    DateProposed: '18/07/2010',
    DateReviewed: '25/08/2010',
    DateImplemented: '01/09/2010',
    'Base Revision': '000',
    Revision: '001A',
    'EC Type': 'Safety Class',
    'EC Title': 'Increase Safety Class 3 to Class 2',
  },
];

// helper to split camelCase or PascalCase
const formatFieldName = (name) =>
  name.replace(/([a-z])([A-Z])/g, '$1 $2');

export default function EngineeringChangesTab() {
  const classes = useStyles();
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState({});

  const handleExpandClick = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filterByLabel =
    filter === 'All' ? 'Filter by' : `Filter by (${filter})`;

  const filteredData =
    filter === 'All'
      ? engineeringChangesData
      : engineeringChangesData.filter((ec) => {
          const statusKeys = Object.keys(statusConfig);

          // Handle "Only X"
          const onlyMatch = statusKeys.find(
            (s) => `Only ${statusConfig[s].label}` === filter
          );
          if (onlyMatch) return ec['EC Status'] === onlyMatch;

          // Handle "Includes X"
          const includesMatch = statusKeys.find(
            (s) => `Includes ${statusConfig[s].label}` === filter
          );
          if (includesMatch) return ec['EC Status'] === includesMatch;

          return true;
        });

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
        const status = ec['EC Status'];
        const statusInfo = statusConfig[status] || {
          color: '#ccc',
          label: status,
        };

        const orderedFields = [
          'Base Revision',
          'Revision',
          'EC Type',
          'EC ID',
          'DateProposed',
        ];

        return (
          <Card key={index} className={classes.card}>
            <CardContent>
              {/* ✅ Chip + expand button at the very top */}
              <Box display='flex' alignItems='center' marginBottom={1}>
                <Chip
                  label={`Only ${statusInfo.label}`}
                  style={{ backgroundColor: statusInfo.color, color: '#fff' }}
                  size='small'
                />
                <IconButton
                  className={classes.expandIcon}
                  onClick={() => handleExpandClick(index)}
                  size='small'
                >
                  {expanded[index] ? (
                    <KeyboardArrowUpIcon />
                  ) : (
                    <KeyboardArrowDownIcon />
                  )}
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

            {/* Expandable AffectedEquipIDs list */}
            <Collapse in={expanded[index]} timeout='auto' unmountOnExit>
              <CardContent>
                {ec.AffectedEquipIDs &&
                  ec.AffectedEquipIDs.split(';').map((id, idx) => (
                    <Box key={idx} className={classes.row}>
                      <Typography className={classes.bodyText}>
                        name_id: {id.trim()}
                      </Typography>
                    </Box>
                  ))}
              </CardContent>
            </Collapse>
          </Card>
        );
      })}
    </Box>
  );
}
