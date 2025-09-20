import React, { useEffect, useState, useContext } from 'react'

// https://github.com/table-library/react-table-library
import { CompactTable } from '@table-library/react-table-library/compact'
import { useTheme } from "@table-library/react-table-library/theme"
import * as page from "@table-library/react-table-library/pagination"
import * as sort from "@table-library/react-table-library/sort"

import { Tooltip } from "@material-ui/core"

import ExcelDownloader from './TablePanelComponents/ExcelDownloader'
import TablePager from './TablePanelComponents/TablePager'
import SelectableCell from './TablePanelComponents/SelectableCell';
import ElementDetails from '../../../components/ElementDetails/ElementDetails'
import { BASELINE_THEME } from './TreePanelTheme';

import { ModelContext } from '../../../contexts/ModelContext'
import { stringValueTypes } from '../../../components/search/consts'

import './TablePanel.scss'

// hard coded page size for element table
// retricting to 100 a most as the table appears in the bottom panel
// and more than 100 isn't usable in the bottom panel
const TABLE_PAGE_SIZE = 100

const TablePanel = ({ readOnly, onView }) => {

   // Model Context
   const { selectedElement, selectedPropRefs, sliceElements } = useContext(ModelContext)

   const paginationSetting = page.usePagination(sliceElements, {
      state: {
        page: 0,
        size: TABLE_PAGE_SIZE,
      }
   })

   const sortSettings = sort.useSort(sliceElements,
      {},
      {
         // functions for sorting columns
         // these are built using the selected property references
         // each column will have a sort key that equals the property reference _id the column represents
         sortFns: (() => {
            let baseSortFns = {
               SEL: (array) => array.sort((a,b) => {
                  if (selectedElement?._id && a._id === selectedElement._id) return -1
                  else return 0
               }),
               ID: (array) => array.sort((a,b) => a._id.localeCompare(b._id))
            }
      
            selectedPropRefs.forEach(spr => {
               baseSortFns[spr._id] = (array) => array.sort((a,b) => {
      
                  let aValue = getPropertyValueIfExists(spr, a)
                  let bValue = getPropertyValueIfExists(spr, b)
      
                  if (stringValueTypes.includes(spr.property.srcType)) {
                     return aValue.localeCompare(bValue)
                  } else {
                     return aValue-bValue
                  }
               })
      
            })
      
            return baseSortFns
         })()
      }
   )

   // columns in the table
   const [ columns, setColumns ] = useState([])

   // the element _ids in expanded rows
   const [ expandedRowIds, setExpandedRowIds ] = useState([])

   // table theme
   // this is based on BASELINE_THEME imported above
   // and tied to the user config
   const [ theme, setTheme ] = useState()

   // whenever the number of elements or the properties change
   // recalculate the columns
   useEffect(() => {

      getTableConfig()
      setExpandedRowIds([])

   }, [selectedPropRefs, sliceElements])


   // get the value to display in the table cell
   const getPropertyValueIfExists = (spr, item) => {

      let propertyList = spr.property.propertyType === 'type' ? item.typeProps : item.instanceProps

      if (propertyList) {
         if (propertyList[spr.property.key] && propertyList[spr.property.key].hasOwnProperty('val')) {
            return propertyList[spr.property.key].val.toString()
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
            label: '', renderCell: (item) => <SelectableCell _id={item._id}></SelectableCell>, sort: {sortKey: 'SEL'}
         },
         {
            label: '_id', renderCell: (item) => item._id, sort: {sortKey: 'ID'}
         }
      ]

      // for each selected property reference add a column with the function to render it's property value
      columns.push(...selectedPropRefs.map(spr => {
         return {
            label: spr.property.dName,
            renderCell: (item) => <Tooltip title={`${spr.property.propertyType} | ${spr.property.propSetName} | ${spr.property.dName}`}>
               <span>{getPropertyValueIfExists(spr, item)}</span>
            </Tooltip>,
            sort: {sortKey: spr._id}
         }
      }))

      // we need to recalculate --data-table-library_grid-template-columns on evey change and set the var to !important
      // this addresses an issue with the column count not being correctly recalculated by the table when columns are
      // added or removed (when selected property refs are added or removed)
      let repeat = selectedPropRefs.length > 0 ? `repeat(${selectedPropRefs.length}, max-content)` : ''
      let theme = useTheme([
         BASELINE_THEME,
         {
           Table: `
             --data-table-library_grid-template-columns: 60px 20% ${repeat} !important;
           `,
         },
      ])

      setTheme(theme)
      setColumns(columns.sort((a,b) => a.label.localeCompare(b.label)))

   }

   // keep track of the currently expanded rows in the table
   const expandRow = (item) => {

      if (expandedRowIds.includes(item._id)) {
         setExpandedRowIds(expandedRowIds.filter(id => id !== item._id))
      } else {
         setExpandedRowIds([...expandedRowIds, item._id])
      }

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
            <div className='row-click-notice'>click rows to view all element properties</div>
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
            sort={sortSettings}
            rowProps={{
               onClick: expandRow
            }}
            rowOptions={{
               renderAfterRow: (item) => ( <>
                  {expandedRowIds.includes(item._id) && <ElementDetails element={item} readOnly={readOnly} onView={onView}/>}
               </>)
            }}
         /></div>}
   </div>

}

export default TablePanel