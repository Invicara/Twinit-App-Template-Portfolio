import React, { useEffect, useMemo, useState } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Box, Checkbox, FormControl, ListItemText, MenuItem, Select, Snackbar } from '@material-ui/core';
import TablePagination from '@mui/material/TablePagination';
import { styled } from '@mui/material/styles';
import MuiAlert from '@material-ui/lab/Alert';

import './AssetTable.scss';

const BASE_COL_MIN_WIDTH = 220;
const DYNAMIC_COL_MIN_WIDTH = 180;

const DEFAULT_COLUMNS = [
  'Type Name',
  'Type ID',
  'Revit Family',
  'Revit Type',
  'Type Mark',
];

const EMPTY_ROWS = [];

const STORAGE_KEY = 'assetTable.selectedExtraProperties.v1';

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

const FilterDropdown = ({ selectedFilter, setSelectedFilter, disabled }) => {
  const filterOptions = DEFAULT_COLUMNS;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <FormControl>
        <Select
          disabled={disabled}
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
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
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

const PropertyColumnsDropdown = ({ options, selected, setSelected, disabled }) => {
  const value = Array.isArray(selected) ? selected : [];

  const [anchorEl, setAnchorEl] = useState(null);

  const menuProps = useMemo(
    () => ({
      anchorEl,
      getContentAnchorEl: null,
      anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
      transformOrigin: { vertical: 'top', horizontal: 'left' },
      disableScrollLock: true,
      PaperProps: {
        style: {
          maxHeight: 360,
          minWidth: anchorEl ? anchorEl.clientWidth : 240,
        },
      },
    }),
    [anchorEl],
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <FormControl>
        <Select
          disabled={disabled}
          multiple
          value={value}
          onOpen={(e) => {
            if (disabled) return;
            setAnchorEl(e.currentTarget);
          }}
          onClose={() => setAnchorEl(null)}
          onChange={(e) => {
            const next = e.target.value;
            setSelected(Array.isArray(next) ? next : []);
          }}
          displayEmpty
          disableUnderline
          IconComponent={() => null}
          renderValue={(selectedVals) => (
            <div
              style={{
                border: '1px solid #DCDCDC',
                borderRadius: 4,
                padding: 8,
                color: '#5D5D5D',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 240,
                whiteSpace: 'nowrap',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <i className='fas fa-columns'></i>
              <span>
                {Array.isArray(selectedVals) && selectedVals.length
                  ? `${selectedVals.length} properties`
                  : 'Add properties'}
              </span>
            </div>
          )}
          MenuProps={menuProps}
        >
          {options.map((name) => (
            <MenuItem key={name} value={name}>
              <Checkbox
                checked={value.indexOf(name) > -1}
                size='small'
                sx={{ padding: '2px' }}
              />
              <ListItemText primary={name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

const FilterBar = ({
  rows,
  setFilteredRows,
  setToast,
  extraPropertyOptions,
  selectedExtraProperties,
  setSelectedExtraProperties,
  disabled,
}) => {
  const [selectedFilter, setSelectedFilter] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [keyword, setKeyword] = useState('');

  const conditionOptions = ['is', 'is not'];

  useEffect(() => {
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
    if (disabled) return;
    setSelectedFilter('');
    setSelectedCondition('');
    setKeyword('');
    setFilteredRows(rows);
  };

  const propertiesDisabled = disabled || extraPropertyOptions.length === 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 12, p: 2 }}>
      <FilterDropdown
        selectedFilter={selectedFilter}
        setSelectedFilter={(v) => {
          if (disabled) return;
          setSelectedFilter(v);
        }}
        disabled={disabled}
      />

      {selectedFilter ? (
        <>
          <FormControl>
            <Select
              disabled={disabled}
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              displayEmpty
              disableUnderline
              IconComponent={() => null}
              inputProps={{ style: { padding: 0 } }}
              renderValue={() => (
                <span style={{ color: selectedCondition ? '#111' : '#B8B8B8' }}>
                  {selectedCondition ? selectedCondition : 'Select Condition'}
                </span>
              )}
              style={{
                border: '1px solid #DCDCDC',
                borderRadius: 4,
                height: 36,
                minWidth: 140,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
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
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'text',
            }}
            disabled={disabled || !selectedCondition}
          />

          <Box
            onClick={clearFilter}
            sx={{
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: '#D32F2F',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              ml: 2,
              opacity: disabled ? 0.5 : 1,
            }}
            title='Clear filter'
          >
            <i className='fas fa-trash-alt'></i>
            <span>Clear filter</span>
          </Box>
        </>
      ) : (
        <Box sx={{ ml: 'auto' }} />
      )}

      <Box sx={{ ml: 'auto' }}>
        <PropertyColumnsDropdown
          options={extraPropertyOptions}
          selected={selectedExtraProperties}
          setSelected={setSelectedExtraProperties}
          disabled={propertiesDisabled}
        />
      </Box>
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

  const rowsSafe = Array.isArray(rows) ? rows : EMPTY_ROWS;
  const hasRows = rowsSafe.length > 0;
  const controlsDisabled = !hasRows;

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    setFilteredRows(rowsSafe);
  }, [rowsSafe]);

  // Persisted selection (can include items not currently available yet)
  const [persistedExtraProperties, setPersistedExtraProperties] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    setFilteredRows(Array.isArray(rows) ? rows : []);
  }, [rows]);

  const safeRows = useMemo(() => (Array.isArray(filteredRows) ? filteredRows : []), [filteredRows]);

  // NEW: clamp page instead of always resetting to 0
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(safeRows.length / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [safeRows.length, rowsPerPage, page]);

  const pagedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return safeRows.slice(start, start + rowsPerPage);
  }, [safeRows, page, rowsPerPage]);

  // Collect ALL non-default property names from the currently available rows (de-dup)
  const extraPropertyOptions = useMemo(() => {
    const keys = new Set();

    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (!r || typeof r !== 'object') return;

      Object.keys(r).forEach((k) => {
        if (k === '__rowKey') return;
        if (DEFAULT_COLUMNS.includes(k)) return;
        keys.add(k);
      });
    });

    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Memo set for fast lookup + stable reference
  const optionSet = useMemo(() => new Set(extraPropertyOptions), [extraPropertyOptions]);

  // Only show selected properties if they exist in current options
  const availableSelectedExtraProperties = useMemo(() => {
    const saved = Array.isArray(persistedExtraProperties) ? persistedExtraProperties : [];
    return saved.filter((k) => optionSet.has(k));
  }, [persistedExtraProperties, optionSet]);

  // Called by dropdown: updates persisted selection but never loses unavailable items
  const handleSetSelectedExtraProperties = (nextAvailableSelection) => {
    const next = Array.isArray(nextAvailableSelection) ? nextAvailableSelection : [];

    setPersistedExtraProperties((prev) => {
      const prevSafe = Array.isArray(prev) ? prev : [];

      // Keep anything that isn't currently available (so it can come back later)
      const keepUnavailable = prevSafe.filter((k) => !optionSet.has(k));

      // Persist = unavailable saved + newly chosen available
      // Dedup while preserving order
      const merged = [...keepUnavailable, ...next];
      return Array.from(new Set(merged));
    });
  };

  // Persist whenever selection changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedExtraProperties || []));
    } catch (e) {
      // ignore
    }
  }, [persistedExtraProperties]);

  // Column order: default columns first, then selected extra props that are actually available
  const visibleColumns = useMemo(() => {
    return [...DEFAULT_COLUMNS, ...availableSelectedExtraProperties];
  }, [availableSelectedExtraProperties]);

  const colCount = visibleColumns.length;

  const handleCloseToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  const baseCellSx = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 360,
  };

  const colMinWidth = (col) => {
    if (col === 'Type Name') return BASE_COL_MIN_WIDTH;
    if (col === 'Type ID') return 140;
    return DYNAMIC_COL_MIN_WIDTH;
  };

  return (
    <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <FilterBar
        rows={rowsSafe}
        setFilteredRows={setFilteredRows}
        setToast={setToast}
        extraPropertyOptions={extraPropertyOptions}
        selectedExtraProperties={availableSelectedExtraProperties}
        setSelectedExtraProperties={handleSetSelectedExtraProperties}
        disabled={controlsDisabled}
      />

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
              {visibleColumns.map((col) => (
                <TableCell key={col} sx={{ minWidth: colMinWidth(col) }}>
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
                      <p className='no-elements-header'>No elements selected</p>
                      <p>Use the tree on the left to select one or more elements.</p>
                    </Box>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row) => (
                // NEW: use ONLY __rowKey (no fallback) to avoid React key collisions
                <StyledTableRow key={row.__rowKey}>
                  {visibleColumns.map((col) => {
                    const value = row?.[col];
                    const display = value != null && value !== '' ? String(value) : '';

                    return (
                      <TableCell
                        // NEW: key uses the guaranteed-unique row.__rowKey
                        key={`${row.__rowKey}::${col}`}
                        sx={{ ...baseCellSx, minWidth: colMinWidth(col) }}
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

      <TablePagination
        component='div'
        count={safeRows.length}
        page={page}
        onPageChange={(e, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(Number(e.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
          sx={{
            '& .MuiTablePagination-toolbar': {
              minHeight: 48,
              alignItems: 'center',
            },

            '& .MuiTablePagination-selectLabel': {
              position: 'relative',
              top: 5,
            },

            '& .MuiTablePagination-displayedRows': {
              position: 'relative',
              top: 5,
            },

            '& .MuiTablePagination-selectIcon': {
              right: 10,
            },

            // keep dropdown aligned
            '& .MuiTablePagination-select': {
              right: 3,
              transform: 'translateY(1px)',
            },

            '& .MuiTablePagination-actions': {
              marginLeft: 6,
            },
          }}
      />
    </Paper>
  );
};

export default AssetTable;
