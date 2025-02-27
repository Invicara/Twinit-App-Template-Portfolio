import React, { useEffect, useState, useContext } from 'react'

import { CompactTable } from '@table-library/react-table-library/compact'
import { useTheme } from "@table-library/react-table-library/theme"
import { getTheme } from "@table-library/react-table-library/baseline"

import { ModelContext } from '../SimpleViewerView'

import './TablePanel.scss'

const COLORS = {
   FONT_PRIMARY: '#141414',
   FONT_SECONDARY: '#757575',
   FONT_DISABLED: '#9e9e9e',
   BORDER: '#e0e0e0'
}

const BASELINE_THEME = {
   Table: '',
   Header: '',
   Body: '',
   BaseRow: `
     font-size: 16px;
   `,
   HeaderRow: `
     color: ${COLORS.FONT_PRIMARY};
   `,
   Row: `
     color: ${COLORS.FONT_SECONDARY};
 
     &.disabled {
       color: ${COLORS.FONT_DISABLED};
     }
 
     &:hover {
       color: ${COLORS.FONT_PRIMARY};
     }
 
     &:not(:last-of-type) > .td {
       border-bottom: 1px solid ${COLORS.BORDER};
     }
   `,
   BaseCell: `
     padding: 6px 12px;
   `,
   HeaderCell: `
     font-weight: bold;
     border-bottom: 1px solid ${COLORS.BORDER};
 
     .resizer-handle {
       background-color: ${COLORS.BORDER};
     }
 
     svg,
     path {
       fill: currentColor;
     }
   `,
   Cell: `
     &:focus {
       outline: dotted;
       outline-width: 1px;
       outline-offset: -1px;
     }
   `,
 }

const TablePanel = () => {

   const { selectedPropRefs, sliceElements } = useContext(ModelContext)

   const [ columns, setColumns ] = useState([])
   const [ theme, setTheme ] = useState()

   useEffect(() => {

      if (selectedPropRefs.length && sliceElements.length) getTableConfig()

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

   const getTableConfig = () => {

      setColumns([])


      let columns = [{
         label: '_id', renderCell: (item) => item._id
      }]

      columns.push(...selectedPropRefs.map(spr => {
         return {
            label: spr.property.dName,
            renderCell: (item) => getPropertyValueIfExists(spr, item)
         }
      }))

      let baselineTheme = getTheme

      console.log(baselineTheme)
      console.log(typeof baselineTheme)


      let theme = useTheme([
         BASELINE_THEME,
         {
           Table: `
             --data-table-library_grid-template-columns: 20% repeat(${columns.length-1}, min-content);
           `,
         },
       ])

      setTheme(theme)
      setColumns(columns)

   }

   return <div className='element-table-container'>
      {!sliceElements.length && <div className='no-table-data'>
         Perform a Search to Display Element Data
      </div>}
      {!!columns.length && <div className='table-wrapper'><CompactTable
         columns={columns}
         theme={theme}
         data={{nodes: sliceElements}}
         layout={{ custom: true, horizontalScroll: true }}
      /></div>}
   </div>

}

export default TablePanel