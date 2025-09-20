import React from 'react'

// https://github.com/bokuweb/react-rnd
import { Rnd } from "react-rnd"

import IafDocViewer from '@dtplatform/iaf-doc-viewer'

import './FloatingModelDocViewer.scss'


const FloatingModelDocViewer = ({docIds, position, size, onClose}) => {


   return <Rnd
         default={{
            x: position?.x || 80,
            y: position?.y || 80,
            width: size?.width || '600px',
            height: size?.height  || '600px',
         }}
         className='float-viewer'
      >

            <div className='close-viewer'><i className='fas fa-times-circle fa-2x' onClick={onClose}></i></div>
            <IafDocViewer
               docIds={docIds}
               onClose={onClose}
               style={{height: '100%', width: '100%'}}
            />

         
      </Rnd>
}

export default FloatingModelDocViewer