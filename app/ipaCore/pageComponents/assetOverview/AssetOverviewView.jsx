import React, { useEffect, useState, useMemo, useCallback } from "react";

import { Box, LinearProgress } from '@mui/material';
import {makeStyles} from '@material-ui/core/styles';

import AssetTree from "./AssetTree";
import AssetTable from "./AssetTable";

import './AssetOverviewView.scss'

const useStyles = makeStyles(theme => ({
  customIcon: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    height: '16px',
    width: '16px',
    color: '#999',
    cursor: 'pointer'
  }
}));

const AssetOverviewView = () => {
  const [loadingNodes, setLoadingNodes] = useState({})
    const [loadingTableData, setLoadingTableData] = useState()
    const [tableData, setTableData] = useState()
    const [selectedElements, setSelectedElements] = useState()
    const [elementData, setElementData] = useState()
    
    useEffect(() => {
      console.log('PARENT tableData updated:', tableData)
    }, [tableData])

    const classes = useStyles()

    const filteredElementData = useMemo(() => {
      return tableData?.filter(data => selectedElements?.includes(data.nameId))
    }, [selectedElements, tableData])

    // Setting elementData once filtered data is available
    useEffect(() => {
      setElementData(filteredElementData)
    }, [filteredElementData])

    // Callback to prevent unnecessary re-renders
    const handleSetSelectedElements = useCallback((newSelection) => {
      setSelectedElements(newSelection)
    }, [])

   const handleSetTableData = useCallback((updater) => {
  setTableData(prev => (typeof updater === 'function' ? updater(prev) : updater))
}, []);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Box
          component="section"
          sx={{
            width: '20%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #DCDCDC',
            padding: 2,
            overflow: 'hidden',
          }}
        >
        <Box sx={{ flexShrink: 0 }}>
          {Object.keys(loadingNodes || {}).some((k) => loadingNodes[k] === true) ? (
            <LinearProgress
               sx={{
                '&.MuiLinearProgress-colorPrimary': { backgroundColor: '#DF158C' },
                '& .MuiLinearProgress-barColorPrimary': { backgroundColor: '#FCE8F3' },
              }}
            />
          ) : null}
          <p className="tree-panel-header">Assets</p>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <AssetTree
            loadingNodes={loadingNodes}
            setLoadingNodes={setLoadingNodes}
            setSelectedElements={handleSetSelectedElements}
            setTableData={handleSetTableData}
          />
        </Box>
      </Box>

       <Box
          sx={{
              width: '80%',
              overflow: 'hidden',
              padding: 2,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#F3F3F3',
              marginRight: '24px'
          }}
        >
            <>
                <p className="table-panel-header">Assets</p>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                    <AssetTable
                    rows={tableData}
                    loadingTableData={loadingTableData}
                    setLoadingTableData={setLoadingTableData}
                  />
                </Box>
            </>
          {loadingTableData ? <LinearProgress classes={{ colorPrimary: classes.colorPrimary, barColorPrimary: classes.barColorPrimary }} /> : null}
        </Box>
    </Box>
    );
};

export default AssetOverviewView;