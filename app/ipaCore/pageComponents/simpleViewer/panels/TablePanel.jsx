import React, { useEffect, useState, useContext } from 'react'

// https://github.com/table-library/react-table-library
import { CompactTable } from '@table-library/react-table-library/compact'
import { useTheme } from "@table-library/react-table-library/theme"
import * as page from "@table-library/react-table-library/pagination";

import ExcelDownloader from './TablePanelComponents/ExcelDownloader'
import TablePager from './TablePanelComponents/TablePager'
import SelectableCell from './TablePanelComponents/SelectableCell';
import { BASELINE_THEME } from './TreePanelTheme';

import { ModelContext } from '../SimpleViewerView'

import './TablePanel.scss'

// hard coded page size for element table
// retricting to 100 a most as the table appears in the bottom panel
// and mroe than 100 isn't usable in the bottom panel
const TABLE_PAGE_SIZE = 100

const TablePanel = () => {

   // Model Context
   const { selectedPropRefs, sliceElements } = useContext(ModelContext)

   const paginationSetting = page.usePagination(sliceElements, {
      state: {
        page: 0,
        size: TABLE_PAGE_SIZE,
      }
   })

   // columns in the table
   const [ columns, setColumns ] = useState([])

   // table theme
   // this is based on BASELINE_THEME imported above
   // and tied to the user config
   const [ theme, setTheme ] = useState()

   // whenever the number of elements or the properties change
   // recalculate the columns
   useEffect(() => {

      getTableConfig()

   }, [selectedPropRefs, sliceElements])


   // get the value to display in the table cell
   const getPropertyValueIfExists = (spr, item) => {

      let propertyList = spr.property.propertyType === 'type' ? item.typeProps : item.instanceProps

      if (propertyList) {
         if (propertyList[spr.property.key] && propertyList[spr.property.key].hasOwnProperty('val')) {
            return propertyList[spr.property.key].val
         } 
      }

      return ''

   }

   // confgure the table display and data
   const getTableConfig = () => {

      setColumns([])

      // element _id column is always he first column in the table
      // _id uses a Selectable Cell component that reacts to the selectedElement in mode context
      // and will highlight the selected elements row in the table
      let columns = [
         {
            label: '', renderCell: (item) => <SelectableCell _id={item._id}></SelectableCell>
         },
         {
            label: '_id', renderCell: (item) => item._id
         }
      ]

      // for each selected property reference add a column with the function to render it's property value
      columns.push(...selectedPropRefs.map(spr => {
         return {
            label: spr.property.dName,
            renderCell: (item) => getPropertyValueIfExists(spr, item)
         }
      }))

      // we need to recalculate --data-table-library_grid-template-columns on evey change and set the var to !important
      // this addresses an issue with the column count not being correctly recalculated by the table when columns are
      // added or removed (when selected property refs are added or removed)
      let theme = useTheme([
         BASELINE_THEME,
         {
           Table: `
             --data-table-library_grid-template-columns: 30px 20% repeat(${selectedPropRefs.length}, min-content) !important;
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