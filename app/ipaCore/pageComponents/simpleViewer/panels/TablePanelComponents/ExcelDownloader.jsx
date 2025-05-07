import React, { useContext } from "react"

import { Tooltip } from "@material-ui/core"

import { IafDataPlugin } from '@invicara/ui-utils'

import { ModelContext } from "../../../../contexts/ModelContext"

// a component tha displays an Excel download icon and allows for downloading
// the table data to an excel xlsx file
const ExcelDownloader = () => {

   // Model Context
   const { selectedModelComposite, selectedPropRefs, sliceElements } = useContext(ModelContext)


   const onDownload = async () => {

      // newer versions of the IafViewer places it's own saveAs function on the global context
      // that saveAs function breaks the SheetJS capability to download spreadsheets
      // so onDownload will look to see if a global saveAs is defined and if so keep a
      // reference to it. Then before saving the spreadsheet, we set the global.saveAs
      // to undefined to allow the SheetJS saveAs workflwo to work. Afterward we set global.saveAs
      // back to its previous function
      let tempGlobalSaveAs = global.saveAs || null

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

         // clear the global.saveAs to allow SheetJS download to work
         global.saveAs = undefined

         let workbook = await IafDataPlugin.createWorkbookFromAoO(sheetArray);
         await IafDataPlugin.saveWorkbook(
               workbook,
               `${selectedModelComposite._name} Element Report.xlsx`
         )

         // set global.saveAs back if had been defined
         if (tempGlobalSaveAs) {
            global.saveAs = tempGlobalSaveAs
         }

      } catch (error) {
         console.error('ERROR: Dowloading Excel File')
         console.error(error)

         if (tempGlobalSaveAs) {
            global.saveAs = tempGlobalSaveAs
         }
      }
   }

   return <Tooltip title='Download Table to Excel'>
      <span className='action download-action' onClick={onDownload}>
         <i className='fas fa-file-download'></i>
      </span>
   </Tooltip>

}

export default ExcelDownloader