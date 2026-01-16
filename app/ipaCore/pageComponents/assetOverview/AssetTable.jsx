import React, { useEffect, useMemo, useState } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Box, FormControl, MenuItem, Select, Snackbar } from '@material-ui/core';
import { styled } from '@mui/material/styles';
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

function Alert(props) {
  return <MuiAlert elevation={6} variant='filled' {...props} />;
}

const FilterDropdown = ({ selectedFilter, setSelectedFilter }) => {
  const filterOptions = ['Type Name', 'Type ID', 'Revit Family', 'Revit Type', 'Type Mark'];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <FormControl>
        <Select
          value={selectedFilter ?? ''}
          onChange={(e) => setSelectedFilter(e.target.value)}
          displayEmpty
          disableUnderline
          IconComponent={() => null}
          renderValue={() => (
            <div
              style={{
                border: '1px solid #DCDCDC',
                borderRadius: 4,
                padding: 8,
                color: '#DF158C',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <i className='fas fa-filter'></i>
              <span>{selectedFilter ? `Filter: ${selectedFilter}` : 'Search/Filter by'}</span>
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

const FilterBar = ({ rows, setFilteredRows, setToast }) => {
  const [selectedFilter, setSelectedFilter] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [keyword, setKeyword] = useState('');

  const conditionOptions = ['is', 'is not'];

  useEffect(() => {
    // When base rows change, reapply filter if we have one; otherwise show all.
    if (!selectedFilter || !selectedCondition || !keyword) {
      setFilteredRows(rows);
      return;
    }

    const lowerKeyword = keyword.toLowerCase();

    const matches = (item) => {
      const v = item?.[selectedFilter];
      const str = v == null ? '' : String(v);
      return str.toLowerCase().includes(lowerKeyword);
    };

    const result = (rows || []).filter((item) => (selectedCondition === 'is' ? matches(item) : !matches(item)));

    if (!result.length) {
      setToast({
        open: true,
        severity: 'error',
        message: `No matching rows found for ${selectedFilter}`,
      });
    }

    setFilteredRows(result);
  }, [rows, selectedFilter, selectedCondition, keyword, setFilteredRows, setToast]);

  const clearFilter = () => {
    setSelectedFilter('');
    setSelectedCondition('');
    setKeyword('');
    setFilteredRows(rows);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 12, p: 2 }}>
      <FilterDropdown selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} />

      {selectedFilter ? (
        <>
          <FormControl>
            <Select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              displayEmpty
              disableUnderline
              IconComponent={() => null}
              renderValue={() => (
                <span style={{ color: selectedCondition ? '#111' : '#B8B8B8' }}>
                  {selectedCondition ? selectedCondition : 'Select Condition'}
                </span>
              )}
              style={{
                border: '1px solid #DCDCDC',
                borderRadius: 4,
                padding: '0 8px',
                minWidth: 140,
              }}
            >
              {conditionOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <input
            type='text'
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder='Enter text...'
            className='property-input'
            style={{
              height: 36,
              border: '1px solid #DCDCDC',
              borderRadius: 4,
              padding: '0 10px',
              minWidth: 240,
            }}
            disabled={!selectedCondition}
          />

          <Box
            onClick={clearFilter}
            sx={{
              cursor: 'pointer',
              color: '#D32F2F',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              ml: 'auto',
            }}
            title='Clear filter'
          >
            <i className='fas fa-trash-alt'></i>
            <span>Clear filter</span>
          </Box>
        </>
      ) : (
        <Box sx={{ ml: 'auto', color: '#5D5D5D' }} />
      )}
    </Box>
  );
};

const AssetTable = ({ rows }) => {
  const [toast, setToast] = useState({
    open: false,
    severity: 'error',
    message: '',
  });

  const [filteredRows, setFilteredRows] = useState(() => (Array.isArray(rows) ? rows : []));

  useEffect(() => {
    setFilteredRows(Array.isArray(rows) ? rows : []);
  }, [rows]);

  const safeRows = useMemo(() => (Array.isArray(filteredRows) ? filteredRows : []), [filteredRows]);

  const dynamicColumns = useMemo(() => {
    const keys = new Set();

    safeRows.forEach((r) => {
      if (!r || typeof r !== 'object') return;

      Object.keys(r).forEach((k) => {
        if (k === '__rowKey') return;
        // base columns stay first; we don't want them duplicated
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

  const baseCellSx = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 360,
  };

  return (
    <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <FilterBar rows={Array.isArray(rows) ? rows : []} setFilteredRows={setFilteredRows} setToast={setToast} />

      <TableContainer
        sx={{
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent',
          '&::-webkit-scrollbar': { height: '8px', width: '6px' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '10px' },
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
              <TableCell sx={{ minWidth: BASE_COL_MIN_WIDTH }}>Type Name</TableCell>
              <TableCell sx={{ minWidth: 140 }}>Type ID</TableCell>

              {dynamicColumns.map((col) => (
                <TableCell key={col} sx={{ minWidth: DYNAMIC_COL_MIN_WIDTH }}>
                  {col}
                </TableCell>
              ))}
            </StyledTableHeadRow>
          </TableHead>

          <TableBody>
            {safeRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} sx={{ height: 'calc(100vh - 300px)', p: 0 }}>
                  <Box
                    sx={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <Box sx={{ maxWidth: 420 }}>
                      <i className='fas fa-search'></i>
                      <p className='no-elements-header'>No Types selected</p>
                      <p>Use the tree on the left to select one or more Revit Types.</p>
                    </Box>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              safeRows.map((row) => (
                <StyledTableRow key={row?.__rowKey ?? `${row?.['Type ID'] ?? ''}::${row?.['Type Name'] ?? ''}`}>
                  <TableCell sx={{ ...baseCellSx, minWidth: BASE_COL_MIN_WIDTH }} title={row?.['Type Name'] ?? ''}>
                    {row?.['Type Name'] ?? '-'}
                  </TableCell>

                  <TableCell sx={{ ...baseCellSx, minWidth: 140 }} title={row?.['Type ID'] ?? ''}>
                    {row?.['Type ID'] ?? '-'}
                  </TableCell>

                  {dynamicColumns.map((col) => {
                    const value = row?.[col];
                    const display = value != null && value !== '' ? String(value) : '-';

                    return (
                      <TableCell
                        key={`${row?.__rowKey ?? 'row'}::${col}`}
                        sx={{ ...baseCellSx, minWidth: DYNAMIC_COL_MIN_WIDTH }}
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
