import React, { useContext } from "react"

import { Tooltip } from "@material-ui/core"

import { IafDataPlugin } from '@invicara/ui-utils'

import { ModelContext } from "../../SimpleViewerView"

const ExcelDownloader = () => {

   const { selectedModelComposite, selectedPropRefs, sliceElements } = useContext(ModelContext)

   const onDownload = async () => {
      
      let rowArray = []

      sliceElements.forEach(elem => {

         let row = {}

         row._id = elem._id

         selectedPropRefs.forEach(spr => {
            row[spr.property.dName] = spr.property.propertyType === 'type' ? elem.typeProps[spr.property.key]?.val || '' :  elem.instanceProps[spr.property.key]?.val || ''
         })

         rowArray.push(row)

      })

      let sortedPropRefs = [...selectedPropRefs].sort((a,b) => a.property.dName.localeCompare(b.property.dName))
      let header = sortedPropRefs.map(spr => spr.property.dName)
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
   }

   return <Tooltip title='Download Table to Excel'>
      <span className='action download-action' onClick={onDownload}>
         <i className='fas fa-file-download'></i>
      </span>
   </Tooltip>

}

export default ExcelDownloader