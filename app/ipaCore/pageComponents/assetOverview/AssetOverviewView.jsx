import React, { useEffect, useState, useMemo, useCallback } from "react";

import { Box, LinearProgress } from '@mui/material';
import {makeStyles} from '@material-ui/core/styles';

import AssetTree from "./AssetTree";
import AssetTable from "./AssetTable";

import './AssetOverviewView.scss'

const useStyles = makeStyles(theme => ({
  colorPrimary: {
      background: '#C71784'
  },
  barColorPrimary: {
      background: 'white'
  },
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
    const [loadingNodes, setLoadingNodes] = useState({A: true})
    const [loadingTableData, setLoadingTableData] = useState()
    const [tableData, setTableData] = useState()
    const [selectedSiteEquipment, setSelectedSiteEquipment] = useState()
    const [equipData, setEquipData] = useState()

    const classes = useStyles()

    // Memoizing the filtered equipData
    const filteredEquipData = useMemo(() => {
      return tableData?.filter(data => selectedSiteEquipment?.includes(data.nameId))
    }, [selectedSiteEquipment, tableData])

    // Setting equipData once filtered data is available
    useEffect(() => {
      setEquipData(filteredEquipData)
    }, [filteredEquipData])

    // Callback to prevent unnecessary re-renders
    const handleSetSelectedSiteEquipment = useCallback((newSelection) => {
      setSelectedSiteEquipment(newSelection)
    }, [])

    const handleSetTableData = useCallback((newTableData) => {
      setTableData(newTableData)
    }, [])

  return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            <Box sx={{ width: '20%', padding: 2, borderRight: '1px solid #DCDCDC'}}>
            {Object.values(loadingNodes).includes(true) ? (
                <LinearProgress classes={{ colorPrimary: classes.colorPrimary, barColorPrimary: classes.barColorPrimary }} />
            ) : null}
                <p className="tree-panel-header">Properties</p>
                <AssetTree 
                    loadingNodes={loadingNodes} 
                    setLoadingNodes={setLoadingNodes}
                    setSelectedSiteEquipment={handleSetSelectedSiteEquipment} 
                    setTableData={handleSetTableData} 
                />
            </Box>

            <Box
                sx={{
                    width: '80%',
                    overflowX: 'auto',
                    padding: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#F3F3F3',
                    marginRight: '24px'
                }}
            >
              {equipData?.length >= 1 ?
                <>
                    <p className="table-panel-header">Equipments</p>
                    <AssetTable 
                        rows={equipData} 
                        loadingTableData={loadingTableData} 
                        setLoadingTableData={setLoadingTableData} 
                    /> 
                </>
              : null}
              {loadingTableData ? <LinearProgress classes={{ colorPrimary: classes.colorPrimary, barColorPrimary: classes.barColorPrimary }} /> : null}
            </Box>
        </Box>
    );
};

export default AssetOverviewView;