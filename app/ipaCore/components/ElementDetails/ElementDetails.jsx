import React, { useContext } from "react"

import FileRow from '../ModelDocs/components/FileRow'
import { ModelContext } from '../../contexts/ModelContext'

import './ElementDetails.scss'

// displays a list of element type and instance properties in a row of the table
// when a row is expanded
const ElementDetails = ({ element, horizontal = true, readOnly, onView }) => {
   const { setSelectedElement, setSliceElements } = useContext(ModelContext)

   if (element.RelatedFiles._list.length > 0) {
      element.files = [];

      for (const item of element.RelatedFiles._list) {
         element.files.push({
            deletable: true,
            viewable: true,
            _id: item._fileId,
            _name: item.name,
            downloadID: item._fileId || null,
            downloadVersionID: item.versions[item.versions.length - 1]._fileVersionId || null,
         });
      }
   }

   return <>
      <table className='file-details-table'>
         <thead>
            <tr>
               <th>Files</th>
            </tr>
         </thead>
         <tbody>
            {element?.files?.map(f => <FileRow
               key={f._id}
               file={f}
               onChange={() => {
                  setSelectedElement(null)
                  setSliceElements([])
               }}
               onView={onView}
               readOnly={readOnly}
            />)}
         </tbody>
      </table>
      <tr className='element-details-row'>
         <td className='element-details-cell'>
            <table className='element-details-table'>
               <thead>
                  <tr>
                     <th colspan='2'>Instance Properties</th>
                  </tr>
               </thead>
               <tbody>
                  {Object.keys(element.instanceProps).toSorted((a, b) => a.localeCompare(b)).map(k => <tr>
                     <td className='element-table-prop-name'>{element.instanceProps[k].dName}</td>
                     <td className='element-table-prop-val'>{element.instanceProps[k].val || ''}</td>
                  </tr>)}
               </tbody>
            </table>
            {!horizontal && <hr />}
            <table className='element-details-table'>
               <thead>
                  <tr>
                     <th colspan='2'>Type Properties</th>
                  </tr>
               </thead>
               <tbody>
                  {Object.keys(element.typeProps).toSorted((a, b) => a.localeCompare(b)).map(k => <tr>
                     <td className='element-table-prop-name'>{element.typeProps[k].dName}</td>
                     <td className='element-table-prop-val'>{element.typeProps[k].val || ''}</td>
                  </tr>)}
               </tbody>
            </table>
         </td>
      </tr>
   </>

}

export default ElementDetails
