import React, { useState } from 'react'

import './EngineerChangeInfo.scss'

const EngineerChangeInfo = ({}) => {
    const [selectedStatus, setSelectedStatus] = useState('')


   return ( 
    <div className="engineer-info">
        <p className="engineer-info-title">EC Title: Adjusted flow rate by +100 gpm</p>
        <div className="engineer-data">
            <p>Base Revision: </p>
            <p>Revision: </p>
            <p>EC Type: </p>
            <p>EC ID: </p>
            <p>Date Reviewed: </p>
        </div>
    </div>
   )
}

export default EngineerChangeInfo