import React, { useEffect, useState, useContext } from 'react'

// https://github.com/table-library/react-table-library
import { CompactTable } from '@table-library/react-table-library/compact'
import { useTheme } from "@table-library/react-table-library/theme"
import * as page from "@table-library/react-table-library/pagination";

import ExcelDownloader from './TablePanelComponents/ExcelDownloader'
import TablePager from './TablePanelComponents/TablePager'
import SelectableCell from './TablePanelComponents/SelectableCell';

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

   const paginationSetting = page.usePagination(sliceElements, {
      state: {
        page: 0,
        size: 100,
      }
    })

   const [ columns, setColumns ] = useState([])
   const [ theme, setTheme ] = useState()

   useEffect(() => {

      getTableConfig()

   }, [selectedPropRefs, sliceElements])

   const getPropertyValueIfExists = (spr, item) => {

      let propertyList = spr.property.propertyType === 'type' ? item.typeProps : item.instanceProps

      if (propertyList) {
         if (propertyList[spr.property.key] && propertyList[spr.property.key].hasOwnProperty('val')) {
            return propertyList[spr.property.key].val
         } 
      }

      return ''

   }

   const getTableConfig = () => {

      setColumns([])

      let columns = [{
         label: '_id', renderCell: (item) => <SelectableCell _id={item._id}>{item._id}</SelectableCell>
      }]

      columns.push(...selectedPropRefs.map(spr => {
         return {
            label: spr.property.dName,
            renderCell: (item) => getPropertyValueIfExists(spr, item)
         }
      }))

      let theme = useTheme([
         BASELINE_THEME,
         {
           Table: `
             --data-table-library_grid-template-columns: 20% repeat(${selectedPropRefs.length}, min-content) !important;
           `,
         },
      ])

      setTheme(theme)
      setColumns(columns.sort((a,b) => a.label.localeCompare(b.label)))

   }

   return <div className='element-table-container'>
      {!sliceElements.length && <div className='no-table-data'>
         Perform a Search to Display Element Data
      </div>}
      {!!columns.length && !!sliceElements.length && <div className='table-wrapper'>
         <div className='table-actions'>
            <div className='ctrls action-ctrls'>
               <span className='actions-header'>Actions:</span>
                  <ExcelDownloader />
            </div>
            <div className='ctrls page-ctrls'>
               <TablePager
                  setPage={paginationSetting.fns.onSetPage}
                  currentPage={paginationSetting.state.page}
                  totalPages={paginationSetting.state.getTotalPages(sliceElements)}
               />
            </div>
         </div>
         <CompactTable
            columns={columns}
            theme={theme}
            data={{nodes: sliceElements}}
            layout={{ custom: true, horizontalScroll: true }}
            pagination={paginationSetting}
         /></div>}
   </div>

}

export default TablePanel