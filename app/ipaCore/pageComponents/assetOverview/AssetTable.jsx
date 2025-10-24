import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import { Box, FormControl, Select, MenuItem } from "@material-ui/core";
import { styled } from '@mui/material/styles';
import { makeStyles } from "@material-ui/core/styles";

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
  formControl: { 
    minWidth: 200 
  },
  dropdown: {
    border: '1px solid #DCDCDC', 
    borderRadius: '4px', 
    color: '#DF158C',
    padding: '8px'
  },
  sortBox: {
    width: '5%'
  }
}));

const SortingDropdown = ({sortedTableData, setSortedTableData}) => {
    const sortingOptions = ['Sort ascending', 'Sort descending']
    const classes = useStyles();

    function sortByNameId(data, order = 'ascending', setSortedTableData) {
        if (order !== 'Sort ascending' && order !== 'Sort descending') {
            throw new Error('Invalid order parameter. Use "ascending" or "descending".');
        }

        const sortedData = [...data].sort((a, b) => {
            if (order === 'Sort ascending') {
                return a.nameId.localeCompare(b.nameId)
            } else {
                return b.nameId.localeCompare(a.nameId)
            }
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
    const filterOptions = ['Equipment Name', 'Name ID', 'Equipment Type', 'Manufacturer', 'Model']

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

const FilteredContainer = ({selectedFilter, setSelectedFilter, sortedTableData, setSortedTableData, rows}) => {
    const [selectedCondition, setSelectedCondition] = useState()

    const classes = useStyles

    const conditionOptions = ['is', 'is not'] 

    const deleteFilter = (rows) => {
        setSelectedCondition()
        setSelectedFilter()
        setSortedTableData(rows)
    }
  
    const filteredData = (keyword) => {
        if (!keyword || !selectedFilter || !selectedCondition) return sortedTableData;
        const lowerKeyword = keyword.toLowerCase()

        const getPropertyValue = (item, propertyName) => {
            const prop = item.Properties?.find(p => p.name === propertyName);
            return prop ? String(prop.val).toLowerCase() : ''
        }

        const matchesFilter = (item) => {
            switch (selectedFilter) {
                case 'Equipment Name':
                    return item.equipmentName?.toLowerCase().includes(lowerKeyword)
                
                case 'Name ID':
                    return item.nameId?.toLowerCase().includes(lowerKeyword)
                
                case 'Equipment Type':
                case 'Manufacturer':
                case 'Model':
                    return getPropertyValue(item, selectedFilter).includes(lowerKeyword)
                
                default:
                    return false
            }
        }

        const result = sortedTableData.filter(item => 
            selectedCondition === 'is' ? matchesFilter(item) : !matchesFilter(item)
        )
        setSortedTableData(result)
    }
    

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            filteredData(event.target.value)
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
                    <input type="text" id="property" name="property" placeholder="Enter text..." onKeyDown={handleKeyDown} className="property-input" />
                </>
                :
                <div className="selecting-condition">
                    <Box className={classes.filterBox}>
                        <FormControl className={classes.formControl}>
                            <Select
                                onChange={(e) => {
                                    setSelectedCondition(e.target.value);
                                }}
                                displayEmpty
                                disableUnderline
                                IconComponent={() => null}
                                renderValue={() => (
                                        <div className={classes.dropdown}>
                                            <span>Select Condition</span>
                                        </div>
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
                <Box className={classes.filterBox}>
                        <FormControl className={classes.formControl}>
                            <Select
                                onChange={(e) => {
                                    setSelectedCondition(e.target.value);
                                }}
                                displayEmpty
                                disableUnderline
                                IconComponent={() => null}
                                renderValue={() => (
                                        <div className={classes.dropdown}>
                                             <i style={{ margin: 'auto'}} className="fas fa-ellipsis-v"></i>
                                        </div>
                                    )}
                            >
                                return (
                                    <MenuItem>
                                        <Box display="flex" alignItems="center" style={{color: '#D32F2F'}} onClick={() => deleteFilter(rows)}>
                                            <i style={{ margin: 'auto'}} className="fas fa-trash-alt"></i>
                                            Delete filter
                                        </Box>
                                    </MenuItem>
                                );
                            </Select>
                        </FormControl>
                    </Box>
            </div>
        </div>
        
    )
}

const AssetTable = ({ rows }) => {
    const [selectedFilter, setSelectedFilter] = useState()
    const [sortedTableData, setSortedTableData] = useState(rows)

    useEffect(() => { 
        setSortedTableData(rows)
    }, [rows])

    const getPropertyValue = (row, name) => {
        const property = row.Properties.find(p => p.name === name)
        return property ? property.val : '-'
    }
 
    return (
        <Paper>
            <TableContainer
                sx={{
                    height: '90vh',
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
                    <TableHead>
                        {!selectedFilter ? 
                            <FilterdDropdown selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter}/>
                        : 
                            <FilteredContainer selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter} sortedTableData={sortedTableData} setSortedTableData={setSortedTableData} rows={rows}/>
                        }
                    </TableHead>
                    <TableHead>
                        <StyledTableHeadRow>
                            <TableCell className="asset-table-header-cell">
                                <p>Equipment Name</p>
                                <SortingDropdown sortedTableData={sortedTableData} setSortedTableData={setSortedTableData}/>
                            </TableCell>
                            <TableCell className="asset-table-header-cell">Name ID</TableCell>
                            <TableCell className="asset-table-header-cell">Equipment Type</TableCell>
                            <TableCell className="asset-table-header-cell">Manufacturer</TableCell>
                            <TableCell className="asset-table-header-cell">Model</TableCell>
                        </StyledTableHeadRow>
                    </TableHead>
                    <TableBody>
                        {_.isEmpty(rows) ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" className="asset-table-no-equip">
                                    <div>
                                        <i className="fas fa-search"></i>
                                        <p className="no-equip-header">No Equipment selected</p>
                                        <p>Use the panel on the left to browse the filter tree and view equipment data.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedTableData?.map((row, idx) => (
                                <StyledTableRow key={idx}>
                                     <TableCell>{row.EquipmentName}</TableCell>
                                    <TableCell>{row.nameId}</TableCell>
                                    <TableCell>{getPropertyValue(row, 'Equipment Type')}</TableCell>
                                    <TableCell>{getPropertyValue(row, 'Manufacturer')}</TableCell>
                                    <TableCell>{getPropertyValue(row, 'Model')}</TableCell>
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