import React, { useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Box, FormControl, Select, MenuItem, Snackbar } from '@material-ui/core';
import { styled } from '@mui/material/styles';
import { makeStyles } from '@material-ui/core/styles';
import MuiAlert from '@material-ui/lab/Alert';

import './AssetTable.scss';

const BASE_COL_MIN_WIDTH = 220;
const DYNAMIC_COL_MIN_WIDTH = 180;

const StyledTableHeadRow = styled(TableRow)(({ theme }) => ({
  backgroundColor: '#eaeaea',
  '& .MuiTableCell-root': {
    color: theme.palette.common.black,
    backgroundColor: '#F9F9F9',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.background.paper,
  },
  '&:nth-of-type(even)': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const useStyles = makeStyles((theme) => ({
  filterBox: {
    marginLeft: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  dropdown: {
    border: '1px solid #DCDCDC',
    borderRadius: '4px',
    color: '#DF158C',
    padding: '8px',
  },
  sortBox: {
    minWidth: 'auto',
    marginLeft: 'auto',
  },
}));

const FilterdDropdown = ({ selectedFilter, setSelectedFilter }) => {
  // Only allow filtering by these fields (as requested)
  const filterOptions = ['Type Name', 'Type ID', 'Revit Family', 'Revit Type', 'Type Mark'];

  const classes = useStyles();

  return (
    <Box className={classes.filterBox}>
      <FormControl className={classes.formControl}>
        <Select
          value={selectedFilter}
          onChange={(e) => {
            setSelectedFilter(e.target.value);
          }}
          displayEmpty
          disableUnderline
          IconComponent={() => null}
          renderValue={() => (
            <div className={classes.dropdown}>
              <i className='fas fa-filter'></i>
              <span>Search/Filter by</span>
            </div>
          )}
        >
          <div className='filter-dropdown'>
            <i className='fas fa-search'></i>
            <p>Search Attributes...</p>
          </div>
          {filterOptions.map((option) => (
            <MenuItem key={option} value={option}>
              <Box display='flex' alignItems='center'>
                {option}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

const FilteredContainer = ({
  selectedFilter,
  setSelectedFilter,
  sortedTableData,
  setSortedTableData,
  rows,
  setToast,
}) => {
  const [selectedCondition, setSelectedCondition] = useState();

  const classes = useStyles();

  const conditionOptions = ['is', 'is not'];

  const deleteFilter = () => {
    setSelectedCondition();
    setSelectedFilter();
    setSortedTableData(rows);
  };

  const filteredData = (keyword, setToast, data = sortedTableData) => {
    if (!keyword || !selectedFilter || !selectedCondition) return data;

    if (!data) {
      setToast({
        open: true,
        severity: 'error',
        message: 'No Asset data selected, please choose from the Asset Tree on the left panel',
      });
      deleteFilter();
      return;
    }

    const lowerKeyword = String(keyword).toLowerCase();

    const matchesFilter = (item) => {
      const raw = item?.[selectedFilter];
      const val = raw == null ? '' : String(raw);
      return val.toLowerCase().includes(lowerKeyword);
    };

    const result = (data || []).filter((item) =>
      selectedCondition === 'is' ? matchesFilter(item) : !matchesFilter(item)
    );

    if (!result.length) {
      setToast({
        open: true,
        severity: 'error',
        message: `No matching property found for ${selectedFilter}`,
      });
    } else {
      setSortedTableData(result);
    }
  };

  const handleKeyDown = (event, setToast) => {
    if (event.key === 'Enter') {
      filteredData(event.target.value, setToast, rows);
    }
  };

  return (
    <div className='filter-container'>
      <div className='selected-filter'>
        <div>{selectedFilter}</div>
      </div>

      {selectedCondition ? (
        <>
          <div className='selected-condition'>
            <div>{selectedCondition}</div>
          </div>
          <input
            type='text'
            id='property'
            name='property'
            placeholder='Enter text...'
            onKeyDown={(event) => handleKeyDown(event, setToast)}
            className='property-input'
          />
        </>
      ) : (
        <div className='selecting-condition'>
          <Box>
            <FormControl className={classes.formControl}>
              <Select
                onChange={(e) => {
                  setSelectedCondition(e.target.value);
                }}
                displayEmpty
                disableUnderline
                IconComponent={() => null}
                renderValue={() => <span style={{ color: '#B8B8B8' }}>Select Condition</span>}
              >
                {conditionOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    <Box display='flex' alignItems='center'>
                      {option}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </div>
      )}

      <div className='delete-dropdown'>
        <Box>
          <FormControl className={classes.formControl}>
            <Select
              onChange={(e) => {
                setSelectedCondition(e.target.value);
              }}
              displayEmpty
              disableUnderline
              IconComponent={() => null}
              renderValue={() => <i style={{ margin: 'auto', padding: '0px' }} className='fas fa-ellipsis-v'></i>}
            >
              <MenuItem onClick={deleteFilter}>
                <Box display='flex' alignItems='center' style={{ color: '#D32F2F' }}>
                  <i style={{ margin: 'auto' }} className='fas fa-trash-alt'></i>
                  Delete filter
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Box>
      </div>
    </div>
  );
};

function Alert(props) {
  return <MuiAlert elevation={6} variant='filled' {...props} />;
}

const AssetTable = ({ rows }) => {
  const [selectedFilter, setSelectedFilter] = useState();
  const [sortedTableData, setSortedTableData] = useState(rows);
  const [toast, setToast] = useState({
    open: false,
    severity: 'error',
    message: '',
  });

  useEffect(() => {
    setSortedTableData(rows);
  }, [rows]);

  const safeRows = useMemo(() => (Array.isArray(sortedTableData) ? sortedTableData : []), [sortedTableData]);

  // Union of dynamic columns across rows (excluding base + internal key)
  const dynamicColumns = useMemo(() => {
    const keys = new Set();

    safeRows.forEach((r) => {
      if (!r || typeof r !== 'object') return;

      Object.keys(r).forEach((k) => {
        if (k === '__rowKey') return;
        if (k === 'Type Name') return;
        if (k === 'Type ID') return;
        keys.add(k);
      });
    });

    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [safeRows]);

  const colCount = 2 + dynamicColumns.length;

  const handleCloseToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  const cellSx = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 380,
  };

  return (
    <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {!selectedFilter ? (
        <FilterdDropdown selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} />
      ) : (
        <FilteredContainer
          selectedFilter={selectedFilter}
          setSelectedFilter={setSelectedFilter}
          sortedTableData={sortedTableData}
          setSortedTableData={setSortedTableData}
          rows={rows}
          setToast={setToast}
        />
      )}

      <TableContainer
        sx={{
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '10px',
          },
        }}
      >
        <Table
          stickyHeader
          aria-label='scrollable table'
          sx={{
            tableLayout: 'auto',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <Snackbar
            open={toast.open}
            autoHideDuration={4000}
            onClose={handleCloseToast}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert onClose={handleCloseToast} severity={toast.severity}>
              {toast.message}
            </Alert>
          </Snackbar>

          <TableHead>
            <StyledTableHeadRow>
              <TableCell className='asset-table-header-cell' sx={{ minWidth: BASE_COL_MIN_WIDTH }}>
                <div>
                  <p>Type Name</p>
                </div>
              </TableCell>

              <TableCell className='asset-table-header-cell' sx={{ minWidth: 140 }}>
                Type ID
              </TableCell>

              {dynamicColumns.map((col) => (
                <TableCell key={col} className='asset-table-header-cell' sx={{ minWidth: DYNAMIC_COL_MIN_WIDTH }}>
                  {col}
                </TableCell>
              ))}
            </StyledTableHeadRow>
          </TableHead>

          <TableBody>
            {!safeRows.length ? (
              <TableRow>
                <TableCell
                  className='asset-table-no-elements'
                  colSpan={colCount}
                  sx={{
                    height: 'calc(100vh - 300px)',
                    p: 0,
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <Box sx={{ maxWidth: 400 }}>
                      <i className='fas fa-search'></i>
                      <p className='no-elements-header'>No Types selected</p>
                      <p>Use the panel on the left to select Revit Types and view data.</p>
                    </Box>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              safeRows.map((row) => (
                <StyledTableRow key={row?.__rowKey ?? `${row?.['Type ID'] ?? ''}::${row?.['Type Name'] ?? ''}`}>
                  <TableCell sx={{ ...cellSx, minWidth: BASE_COL_MIN_WIDTH }} title={row?.['Type Name'] ?? ''}>
                    {row?.['Type Name'] ?? '-'}
                  </TableCell>

                  <TableCell sx={{ ...cellSx, minWidth: 140 }} title={row?.['Type ID'] ?? ''}>
                    {row?.['Type ID'] ?? '-'}
                  </TableCell>

                  {dynamicColumns.map((col) => {
                    const value = row?.[col];
                    const display = value != null && value !== '' ? String(value) : '-';

                    return (
                      <TableCell
                        key={`${row?.__rowKey ?? 'row'}::${col}`}
                        sx={{ ...cellSx, minWidth: DYNAMIC_COL_MIN_WIDTH }}
                        title={display}
                      >
                        {display}
                      </TableCell>
                    );
                  })}
                </StyledTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default AssetTable;
