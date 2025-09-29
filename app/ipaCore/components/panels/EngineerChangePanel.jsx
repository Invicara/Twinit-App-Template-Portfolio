import React, { useRef, useContext, useState, useEffect } from 'react'

import { Tab, Tabs, Box, LinearProgress } from "@material-ui/core";
import {makeStyles} from '@material-ui/core/styles';

import EngineerChangeView from '../tabs/EngineerChangeView';
import SiteEquipmentView from '../tabs/SiteEquipmentView'

import { useTreeData } from '../../contexts/TreeContext';
  
const EngineerChangePanel = ({}) => {
    const [selectedTab, setSelectedTab] = useState('tab1')

    const useStyles = makeStyles(theme => ({
        root: {
            flexGrow: 1,
            borderRadius: '0px',
            height: 10
        },
            colorPrimary: {
            background: '#C71784'
        },
            barColorPrimary: {
            background: '#FCE8F3',
        },
            customTabRoot: {
            color: "#C71784"
        },
            customTabIndicator: {
            backgroundColor: "#C71784"
        }
    }))
      
    const classes = useStyles()

    const handlerTabChange = (tab) => {
        setSelectedTab(tab)
    }

   const renderTabContent = () => {
        switch (selectedTab) {
            case 'tab1':
                return <EngineerChangeView />
            case 'tab2':
                return <SiteEquipmentView LevelData={LevelData}/>
            default:
                return null
        }
    }

    const [ECs, setECs] = useState(null);
    const [LevelData, setLevelData] = useState()

    const { levelData, loading, error, fetchTreeData } = useTreeData();

    useEffect(() => {
        const run = async () => {
            // TODO replaces these values for when we select on a Facility/Unit 
            const treeLevelData = await fetchTreeData("A", "01");
            setLevelData(treeLevelData)
        }

        run()
    }, [fetchTreeData]);

   return ( 
    <>
        <Box sx={{ width: '100%', borderBottom: '1px solid lightGrey' }} >
            <Tabs
                value={selectedTab}
                aria-label="tabs"
                classes={{
                    root: classes.customTabRoot,
                    indicator: classes.customTabIndicator
                }}
                centered={false}
            >
                <Tab value="tab1" label="Engineering Changes" disableRipple style={{textTransform: 'capitalize', fontSize: '15px'}} onClick={() => {
                    handlerTabChange('tab1')
                }} />
                <Tab value="tab2" label="Site Equipment" disableRipple style={{textTransform: 'capitalize', fontSize: '15px'}} onClick={() => {
                    handlerTabChange('tab2')
                }} />
            </Tabs>
        </Box>
        {renderTabContent()}
    </>
   )
}

export default EngineerChangePanel