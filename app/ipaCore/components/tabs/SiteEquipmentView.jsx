import React, { useState } from 'react'

import SearchIcon from '@material-ui/icons/Search';
import { makeStyles } from '@material-ui/core/styles';

import SearchableTreeView from '../TreeSearch/SearchableTreeView'
import './SiteEquipmentView.scss'

const SiteEquipmentView = ({LevelData}) => {
    const [searchText, setSearchText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchChange = (e) => {
        setSearchText(e.target.value);
    };

    const useStyles = makeStyles((theme) => ({
        customIcon: {
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            height: '16px', 
            width: '16px',
            color: '#999',
        },
    }));

    const classes = useStyles();

   return ( 
    <>
        <div className="search-bar-container">
            <input
                type="text"
                placeholder="Search"
                className="search-bar-input"
                value={searchText}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                    setSearchQuery(searchText);
                    }
                }}
            />
            <SearchIcon class={classes.customIcon}/>
        </div>
        {LevelData ? <SearchableTreeView LevelData={LevelData}/>
         : 
            <p>Loading Data...</p>
         }
    </>
   )
}

export default SiteEquipmentView