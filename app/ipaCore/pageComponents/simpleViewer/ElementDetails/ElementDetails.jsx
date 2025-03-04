import React from "react"

import './ElementDetails.scss'

// displays a list of element type and instance properties in a row of the table
// when a row is expanded
const ElementDetails = ({element, horizontal=true}) => {

   return <tr className='element-details-row'>
      <td className='element-details-cell'>
         <table className='element-details-table'>
            <thead>
               <tr>
                  <th colspan='2'>Instance Properties</th>
               </tr>
            </thead>
            <tbody>
               {Object.keys(element.instanceProps).toSorted((a,b) => a.localeCompare(b)).map(k => <tr>
                  <td className='element-table-prop-name'>{element.instanceProps[k].dName}</td>
                  <td className='element-table-prop-val'>{element.instanceProps[k].val || ''}</td>
               </tr>)}
            </tbody>
         </table>
         {!horizontal && <hr/>}
         <table className='element-details-table'>
            <thead>
               <tr>
                  <th colspan='2'>Type Properties</th>
               </tr>
            </thead>
            <tbody>
            {Object.keys(element.typeProps).toSorted((a,b) => a.localeCompare(b)).map(k => <tr>
                  <td className='element-table-prop-name'>{element.typeProps[k].dName}</td>
                  <td className='element-table-prop-val'>{element.typeProps[k].val || ''}</td>
               </tr>)}
            </tbody>
         </table>
      </td>
   </tr>

}

export default ElementDetails