import React, {useState } from 'react'

import { FilterDropdown } from '../dropdown/FilterDropdown';
import EngineerChangeCard from '../Cards/EngineerChangeCard'
  
const EngineerChangeView = ({}) => {
    const [selectedStatus, setSelectedStatus] = useState('')


   return ( 
    <>
        <FilterDropdown selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus}/>
        {/* This should be a map for each of the EC's recieved */}
        <EngineerChangeCard />
    </>
   )
}

export default EngineerChangeView