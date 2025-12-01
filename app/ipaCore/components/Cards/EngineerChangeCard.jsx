import React, {useState } from 'react'

import EngineerChangeInfo from'./EngineerChangeInfo'

import './EngineerChangeCard.scss'

// TODO remove this
const dummyData = [
    {
        SiteEquipmentId: 'FCA01RCSPumpRCP-A-011',
        status: 'Approved'
    },
    {
        SiteEquipmentId: 'FCA01RCSPumpRCP-A-012',
        status: 'Registered'
    }
]

const colorKey = {
    Approved: {
        backgroundColor: '#D1E7D1',
        color: '#1A8817'
    },
    Registered: {
        backgroundColor: '#E6C7F0',
        color: '#8E11BA'
    },
    Closed: {
        backgroundColor: '#DCDCDC',
        color: '#5D5D5D'
    }
}

const EngineerChangeCard = ({}) => {
    const [isExpanded, setIsExpaded] = useState(false)

    const handleExpand = () => {
        setIsExpaded(!isExpanded)
    }


   return ( 
    <div className="engineer-change-card">
        <div className="status-dropdown">
            {/* // TODO dynamically change the colors based on the status */}
            <div style={{backgroundColor: '#D1E7D1', color: '#1A8817'}} className="engineer-status-tag">Approved</div>
            <i className="fas fa-chevron-down" style={{alignContent: 'center', cursor: 'pointer'}} onClick={() => handleExpand()}></i>
        </div>

        <EngineerChangeInfo />
        {isExpanded ? 
            dummyData.map((data) => (
                <div className="engineer-site-equipment-id">
                    <p className="engineer-equipment-id">Name id</p>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        {/* Site Equipment - Equipment ID */}
                        <p style={{margin: '0px'}}>{data.SiteEquipmentId}</p>
                        <p style={{margin: '0px', backgroundColor: colorKey[data.status].backgroundColor, color: colorKey[data.status].color}} className="engineer-status-tag" >{data.status}</p>
                    </div> 
                </div>
            )) 
        : null}
    </div>
   )
}

export default EngineerChangeCard 