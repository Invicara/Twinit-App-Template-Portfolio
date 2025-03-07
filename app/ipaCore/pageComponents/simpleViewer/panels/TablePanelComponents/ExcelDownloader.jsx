import React, { useContext } from "react"

import { Tooltip } from "@material-ui/core"

import { IafDataPlugin } from '@invicara/ui-utils'

import { ModelContext } from "../../ModelContext"

// a component tha displays an Excel download icon and allows for downloading
// the table data to an excel xlsx file
const ExcelDownloader = () => {

   // Model Context
   const { selectedModelComposite, selectedPropRefs, sliceElements } = useContext(ModelContext)


   const onDownload = async () => {
      
      try {
         let rowArray = []

         // for each of the elements in the table create a new row object
         // each objkect will have a key and value for _id and each selected property reference
         sliceElements.forEach(elem => {

            let row = {}

            row._id = elem._id

            selectedPropRefs.forEach(spr => {
               row[spr.property.dName] = spr.property.propertyType === 'type' ? elem.typeProps[spr.property.key]?.val || '' :  elem.instanceProps[spr.property.key]?.val || ''
            })

            rowArray.push(row)

         })

         // sort the prop refs by display name and then created the sorted headers
         let sortedPropRefs = [...selectedPropRefs].sort((a,b) => a.property.dName.localeCompare(b.property.dName))
         let header = sortedPropRefs.map(spr => spr.property.dName)
         // _id is always he first column
         header.unshift('_id')

         let sheetArray = [
            {
               sheetName: `Model Report`,
               objects: rowArray,
               header
            }
         ]


         let workbook = await IafDataPlugin.createWorkbookFromAoO(sheetArray);
         await IafDataPlugin.saveWorkbook(
               workbook,
               `${selectedModelComposite._name} Element Report.xlsx`
         )
      } catch (error) {
         console.error('ERROR: Dowloading Excel File')
         console.error(error)
      }
   }

   return <Tooltip title='Download Table to Excel'>
      <span className='action download-action' onClick={onDownload}>
         <i className='fas fa-file-download'></i>
      </span>
   </Tooltip>

}

export default ExcelDownloader