import React from 'react';
import {
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@material-ui/core';

// Sample static data
const initialRows = [
  { ecId: 1, ecTitle: 'Adjusted flow rate by +100 gpm', ecStatus: 'Approved', equipmentRevision: '000A', ecType: 'Technical Parameters' },
  { ecId: 2, ecTitle: 'Replaced pump P-101', ecStatus: 'Registered', equipmentRevision: '001B', ecType: 'Hardware Change' },
  { ecId: 3, ecTitle: 'Updated pressure sensor calibration', ecStatus: 'Closed', equipmentRevision: '002C', ecType: 'Technical Parameters' },
  { ecId: 4, ecTitle: 'Added new safety valve', ecStatus: 'Approved', equipmentRevision: '003D', ecType: 'Hardware Change' },
  { ecId: 5, ecTitle: 'Recalibrated temperature gauge', ecStatus: 'Registered', equipmentRevision: '004E', ecType: 'Technical Parameters' },
];

const useStyles = makeStyles((theme) => ({
  table: {
    minWidth: 650,
  },
  tableContainer: {
    marginTop: theme.spacing(3),
  },
}));

const ChangeList = () => {
  const classes = useStyles();

  return (
    <TableContainer component={Paper} className={classes.tableContainer}>
      <Table className={classes.table} aria-label="engineering change list">
        <TableHead>
          <TableRow>
            <TableCell>ECID</TableCell>
            <TableCell align="right">EC Title</TableCell>
            <TableCell align="right">EC Status</TableCell>
            <TableCell align="right">Equipment Revision</TableCell>
            <TableCell align="right">Ec Type</TableCell>
            <TableCell align="right">Ec Title</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {initialRows.map((row) => (
            <TableRow key={row.ecId}>
              <TableCell component="th" scope="row">{row.ecId}</TableCell>
              <TableCell align="right">{row.ecTitle}</TableCell>
              <TableCell align="right">{row.ecStatus}</TableCell>
              <TableCell align="right">{row.equipmentRevision}</TableCell>
              <TableCell align="right">{row.ecType}</TableCell>
              <TableCell align="right">{row.ecTitle}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ChangeList;