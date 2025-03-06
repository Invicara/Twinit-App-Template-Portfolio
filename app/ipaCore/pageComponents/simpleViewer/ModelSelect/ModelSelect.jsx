import React, { useEffect, useContext } from "react"

import { ModelContext } from "../ModelContext"

import './ModelSelect.scss'

// model select component that allows the user to select an imported model
// and displays the sources of the currenly selected model
const ModelSelect = () => {

   const { selectedModelComposite, setSelectedModelComposite, availableModelComposites } = useContext(ModelContext)

   // if only one model is in the available list, select it by default
   useEffect(() => {
      if (availableModelComposites?.length === 1) {
         onModelSelect(availableModelComposites[0]._id)
      }
   },[availableModelComposites])

   const onModelSelect = (modelCompositeId) => {

      setSelectedModelComposite(undefined)

      // we need this timeout to give the IafViewer time to reset its own internal state
      // if we switch between models too quickly we get errors
      setTimeout(async () => {
         let selectedModel = availableModelComposites.find(amc => amc._id === modelCompositeId)
         setSelectedModelComposite(selectedModel)
      }, 1000)
   }

   return <>
      <div className='model-select'>
         <label>Select a Model
            {!!availableModelComposites?.length && <select onChange={(e) => onModelSelect(e.target.value)} value={selectedModelComposite?._id}>
               <option value={0} disabled selected>Select a Model to View</option>
               {availableModelComposites.sort((a,b) => a._name.localeCompare(b._name)).map(amc => <option key={amc._id} value={amc._id}>{amc._name}</option>)}
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