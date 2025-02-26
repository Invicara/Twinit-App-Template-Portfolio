import React, { useEffect, useState, useContext } from 'react'

import { CompactTable } from '@table-library/react-table-library/compact'

import { ModelContext } from '../SimpleViewerView'

import './TablePanel.scss'

const TablePanel = () => {

   const { selectedPropRefs, sliceElements } = useContext(ModelContext)

   const [ columns, setColumns ] = useState([])

   useEffect(() => {

      if (selectedPropRefs.length && sliceElements.length) getColumns()

   }, [selectedPropRefs, sliceElements])

   const getPropertyValueIfExists = (spr, item) => {

      let propertyList = spr.property.propertyType === 'type' ? item.typeProps : item.instanceProps

      if (propertyList) {
         if (propertyList._list[0] && propertyList._list[0].properties[spr.property.key] && propertyList._list[0].properties[spr.property.key].hasOwnProperty('val')) {
            return propertyList._list[0].properties[spr.property.key].val
         } 
      }

      return ''

   }

   const getColumns = () => {

      setColumns([])

      // rerender was happening too fast and running into a ubug with
      // CompactTable, whre removing a column was not recalculating the
      // number of columns, and displaying too may columns
      setTimeout(() => {
         let columns = [{
            label: '_id', renderCell: (item) => item._id
         }]
   
         columns.push(...selectedPropRefs.map(spr => {
            return {
               label: spr.property.dName,
               renderCell: (item) => getPropertyValueIfExists(spr, item)
            }
         }))
   
         setColumns(columns)
      }, 1000)

      

   }

   return <div className='element-table-container'>
      {!sliceElements.length && <div className='no-table-data'>
         Perform a Search to Display Element Data
      </div>}
      {!!columns.length && <div className='table-wrapper'><CompactTable
         columns={columns}
         data={{nodes: sliceElements}}
      /></div>}
   </div>


}

export default TablePanel