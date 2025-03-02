import React, { useEffect, useContext } from "react"

import { ModelContext } from "../SimpleViewerView"

import './ModelSelect.scss'

const ModelSelect = ({availableModels, onModelSelect}) => {

   const { selectedModelComposite } = useContext(ModelContext)

   useEffect(() => {
      if (availableModels?.length === 1) {
         onModelSelect(availableModels[0]._id)
      }
   },[availableModels])

   return <>
      <div className='model-select'>
         <label>Select a Model
            {!!availableModels?.length && <select onChange={(e) => onModelSelect(e.target.value)} value={selectedModelComposite?._id}>
               <option value={0} disabled selected>Select a Model to View</option>
               {availableModels.sort((a,b) => a._name.localeCompare(b._name)).map(amc => <option key={amc._id} value={amc._id}>{amc._name}</option>)}
            </select>}
         </label>
      </div>
      {selectedModelComposite && <table className='model-info-table'>
         <tbody>
            {selectedModelComposite._versions[0]._userAttributes.model?.source && <tr>
               <td className='prop-name small'>Source</td>
            </tr>}
            {selectedModelComposite._versions[0]._userAttributes.model?.source &&  <tr>
               <td className='small'>{selectedModelComposite._versions[0]._userAttributes.model?.source}</td>
            </tr>}
            {selectedModelComposite._versions[0]._userAttributes.model?.originalSource && <tr>
               <td className='prop-name small'>Original Source</td>
            </tr>}
            {selectedModelComposite._versions[0]._userAttributes.model?.originalSource && <tr>
               <td className='small'>{selectedModelComposite._versions[0]._userAttributes.model?.originalSource}</td>
            </tr>}
         </tbody>
      </table>}
   </>

}

export default ModelSelect