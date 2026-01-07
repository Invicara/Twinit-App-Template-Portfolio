import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import { Box, FormControl, Select, MenuItem, Snackbar } from "@material-ui/core";
import { styled } from '@mui/material/styles';
import { makeStyles } from "@material-ui/core/styles";
import MuiAlert from "@material-ui/lab/Alert";

import './AssetTable.scss'

const StyledTableHeadRow = styled(TableRow)(({ theme }) => ({
    backgroundColor: '#eaeaea',
    '& .MuiTableCell-root': {
        color: theme.palette.common.black, // Header text color
        backgroundColor: '#F9F9F9',
        fontWeight: 'bold',
    },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
    '&:nth-of-type(odd)': {
        backgroundColor: theme.palette.background.paper, // Odd row color
    },
    '&:nth-of-type(even)': {
        backgroundColor: theme.palette.action.hover, // Even row color
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
    padding: '8px'
  },
  sortBox: {
    minWidth: 'auto',
    marginLeft: 'auto'
  }
}));

const SortingDropdown = ({sortedTableData, setSortedTableData}) => {
    const sortingOptions = ['Sort ascending', 'Sort descending']
    const classes = useStyles();

    function sortByName(data, order = 'ascending', setSortedTableData) {
  if (order !== 'Sort ascending' && order !== 'Sort descending') {
    throw new Error('Invalid order parameter. Use "ascending" or "descending".')
  }

  const sortedData = [...data].sort((a, b) => {
    const aName = String(a?.Name || '')
    const bName = String(b?.Name || '')
    return order === 'Sort ascending' ? aName.localeCompare(bName) : bName.localeCompare(aName)
  })

  setSortedTableData(sortedData)
}


    return (
        <Box className={classes.sortBox}>
            <FormControl className={classes.formControl}>
                <Select
                    onChange={(e) => {
                        sortByNameId(sortedTableData, e.target.value, setSortedTableData);
                    }}
                    displayEmpty
                    disableUnderline
                    IconComponent={() => null}
                    renderValue={() => (
                        <div>
                            <i className="fas fa-sort" style={{color: '#5D5D5D'}}></i>
                        </div>
                    )}
                >
                {sortingOptions.map((option) => {
                    return (
                        <MenuItem key={option} value={option}>
                            <Box display="flex" alignItems="center">
                                {option}
                            </Box>
                        </MenuItem>
                    );
                })}
                </Select>
            </FormControl>
        </Box>
    )
}

const FilterdDropdown = ({selectedFilter, setSelectedFilter}) => {
    const filterOptions = ['Name', 'ID', 'Display Name', 'Source Type', 'Value'];

    const classes = useStyles()

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
                            <i className="fas fa-filter"></i>
                            <span>Search/Filter by</span>
                        </div>
                    )}
                >
                    <div className="filter-dropdown">
                        <i className="fas fa-search"></i>
                        <p>Search Attributes...</p>
                    </div>
                    {filterOptions.map((option) => {
                        const displayText = option === "All" ? "All" : option[0] + option.slice(1).toLowerCase();
                        return (
                            <MenuItem key={option} value={option}>
                                <Box display="flex" alignItems="center">
                                    {displayText}
                                </Box>
                            </MenuItem>
                        );
                    })}
                </Select>
            </FormControl>
        </Box>
    )
}

const FilteredContainer = ({selectedFilter, setSelectedFilter, sortedTableData, setSortedTableData, rows, setToast}) => {
    const [selectedCondition, setSelectedCondition] = useState()

    const classes = useStyles()

    const conditionOptions = ['is', 'is not'] 

    const deleteFilter = (rows) => {
        setSelectedCondition()
        setSelectedFilter()
        setSortedTableData(rows)
    }
  
    const filteredData = (keyword, setToast, data = sortedTableData) => {
        if (!keyword || !selectedFilter || !selectedCondition) return data;

        if(!data) {
            setToast({
                open: true,
                severity: "error",
                message: `No Asset data selected, please choose from the Asset Tree on the left panel`,
            })
            deleteFilter()
        }
        const lowerKeyword = keyword.toLowerCase()

        // const getPropertyValue = (item, propertyName) => {
        //     const prop = item.Properties?.find(p => p.name === propertyName);
        //     return prop ? String(prop.val).toLowerCase() : ''
        // }

       const matchesFilter = (item) => {
  const name = String(item?.Name || '').toLowerCase()
  const id = String(item?.ID || '').toLowerCase()
  const displayName = String(item?.['Display Name'] || '').toLowerCase()
  const sourceType = String(item?.['Source Type'] || '').toLowerCase()
  const value = String(item?.Value ?? '').toLowerCase()

  switch (selectedFilter) {
    case 'Name':
      return name.includes(lowerKeyword)

    case 'ID':
      return id.includes(lowerKeyword)

    case 'Display Name':
      return displayName.includes(lowerKeyword)

    case 'Source Type':
      return sourceType.includes(lowerKeyword)

    case 'Value':
      return value.includes(lowerKeyword)

    default:
      return false
  }
}

        const result = data.filter(item => 
            selectedCondition === 'is' ? matchesFilter(item) : !matchesFilter(item)
        )

        if(_.isEmpty(result)) {
            setToast({
                open: true,
                severity: "error",
                message: `No matching property found for ${selectedFilter}`,
            })
        } else {
            setSortedTableData(result)
        }
    }
    

    const handleKeyDown = (event, setToast) => {
        if (event.key === 'Enter') {
            filteredData(event.target.value, setToast, rows)
        }
    }

    return (
        <div className="filter-container">
            <div className="selected-filter">
                <div>{selectedFilter}</div>
            </div>
            { selectedCondition ? 
                <>
                    <div className='selected-condition'>
                        <div >
                            {selectedCondition}
                        </div> 
                    </div>
                    <input type="text" id="property" name="property" placeholder="Enter text..." onKeyDown={(event) => handleKeyDown(event, setToast)} className="property-input" />
                </>
                :
                <div className="selecting-condition">
                    <Box>
                        <FormControl className={classes.formControl}>
                            <Select
                                onChange={(e) => {
                                    setSelectedCondition(e.target.value);
                                }}
                                displayEmpty
                                disableUnderline
                                IconComponent={() => null}
                                renderValue={() => (
                                        <span style={{color: '#B8B8B8'}}>Select Condition</span>
                                    )}
                            >
                                {conditionOptions.map((option) => {
                                    return (
                                        <MenuItem key={option} value={option}>
                                            <Box display="flex" alignItems="center">
                                                {option}
                                            </Box>
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                    </Box>
                </div>
            }
             <div className="delete-dropdown">
                    <Box>
                        <FormControl className={classes.formControl}>
                            <Select
                                onChange={(e) => {
                                    setSelectedCondition(e.target.value);
                                }}
                                displayEmpty
                                disableUnderline
                                IconComponent={() => null}
                                renderValue={() => (
                                        <i style={{ margin: 'auto', padding: '0px'}} className="fas fa-ellipsis-v"></i>
                                    )}
                            >
                                <MenuItem onClick={() => deleteFilter(rows)}>
                                    <Box display="flex" alignItems="center" style={{color: '#D32F2F'}}>
                                        <i style={{ margin: 'auto'}} className="fas fa-trash-alt"></i>
                                        Delete filter
                                    </Box>
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
            </div>
        </div>
        
    )
}

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

const AssetTable = ({ rows }) => {
    const [selectedFilter, setSelectedFilter] = useState()
    const [sortedTableData, setSortedTableData] = useState(rows)
    const [toast, setToast] = useState({
        open: false,
        severity: "error",
        message: "",
    })

    useEffect(() => { 
        setSortedTableData(rows)
    }, [rows])

    const getPropertyValue = (row, name) => {
        const property = row.Properties.find(p => p.name === name)
        return property ? property.val : '-'
    }

    const handleCloseToast = () => {
        setToast((prev) => ({ ...prev, open: false }));
    };
 
    return (
        <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
             {!selectedFilter ? (
                <FilterdDropdown
                    selectedFilter={selectedFilter}
                    setSelectedFilter={setSelectedFilter}
                />
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
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent',
                    '&::-webkit-scrollbar': {
                    width: '6px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '10px',
                    },
                }}
            >
                <Table stickyHeader aria-label="scrollable table">
                    <Snackbar
                        open={toast.open}
                        autoHideDuration={4000}
                        onClose={handleCloseToast}
                        anchorOrigin={{ vertical: "top", horizontal: "center" }}
                    >
                        <Alert onClose={handleCloseToast} severity={toast.severity}>
                            {toast.message}
                        </Alert>
                    </Snackbar>
                    <TableHead>
                        <StyledTableHeadRow>
                            <TableCell className="asset-table-header-cell" sx={{ width: '30%' }}>
                                <div>
                                    <p>Name</p>
                                    <SortingDropdown sortedTableData={sortedTableData} setSortedTableData={setSortedTableData}/>
                                </div>
                            </TableCell>
                            <TableCell className="asset-table-header-cell">ID</TableCell>
                            <TableCell className="asset-table-header-cell">Display Name</TableCell>
                            <TableCell className="asset-table-header-cell">Source Type</TableCell>
                            <TableCell className="asset-table-header-cell">Value</TableCell>
                        </StyledTableHeadRow>
                    </TableHead>
                    <TableBody>
                        {_.isEmpty(rows) ? (
                            <TableCell
                                className="asset-table-no-elements"
                                colSpan={5}
                                sx={{
                                    height: 'calc(100vh - 300px)', // adjust based on your header height
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
                                        <i className="fas fa-search"></i>
                                        <p className="no-elements-header">No Elements selected</p>
                                        <p>Use the panel on the left to browse the filter tree and view data.</p>
                                    </Box>
                                </Box>
                            </TableCell>
                        ) : (
                            sortedTableData?.map((row, idx) => (
                              
                                    <StyledTableRow key={idx}>
                                        <TableCell sx={{ width: '30%' }}>{row.Name}</TableCell>
                                        <TableCell>{row.ID}</TableCell>
                                        <TableCell>{row['Display Name']}</TableCell>
                                        <TableCell>{row['Source Type']}</TableCell>
                                        <TableCell>{row.Value ? row?.Value : '-'}</TableCell>
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