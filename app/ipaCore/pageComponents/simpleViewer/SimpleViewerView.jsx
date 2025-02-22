// version dtf-1.0

import React, { useState, useEffect, useRef } from 'react'

import { IafViewerDBM } from '@dtplatform/iaf-viewer'
import { IafProj, IafItemSvc } from '@dtplatform/platform-api'
import { IafScriptEngine } from '@dtplatform/iaf-script-engine'
import { SimpleTextThrobber } from '@invicara/ipa-core/modules/IpaControls'

import "@dtplatform/iaf-viewer/dist/iaf-viewer.css";
import './SimpleViewerView.scss'

const SimpleViewerView = (props) => {

   // used to access viewer commands, not used in this example
   const viewerRef = useRef()

   // the list of NamedCompositeItemns in the Item Service which represent imported models
   const [ availableModelComposites, setAvailableModelComposites ] = useState([])
   // the currently selected NamedCompositeItem (model) to display in the viewer
   const [ selectedModelComposite, setSelectedModelComposite ] = useState()

   // the ids of the selected elements in the 3D/2D view
   // this example enforces single element selection by only ever assigning
   // one id to this array
   const [ selection, setSelection ] = useState([])

   // if we are fetching individual element item data fom Twinit
   const [ loadingElement, setLoadingElement ] = useState(false)
   // the currently selected element in the model with element and property data
   const [ selectedElement, setSelectedElement ] = useState()

   // these are not used in this example, but must be provided to the viewer
   const [ sliceElementIds, setSliceElementIds ] = useState([])
   const [ colorGroups, setColorGroups ] = useState([])

   useEffect(() => {
      loadModels()
   }, [])

   const loadModels = async () => {

      try {
         let currentProject = await IafProj.getCurrent()
         let importedModelComposites = await IafProj.getModels(currentProject)
         setAvailableModelComposites(importedModelComposites)
      } catch (err) {
         console.error("ERROR: Retrieving Imported Models")
         console.error(err)
         setAvailableModelComposites([{ _id: 0, _name:"Error Retrieving Imported Models"}])
      }
   }

   const handleModelSelect = (modelCompositeId) => {

      setSelection([])
      setSelectedElement(null)
      setSelectedModelComposite(undefined)

      setTimeout(() => {
         let selectedModel = availableModelComposites.find(amc => amc._id === modelCompositeId)
         setSelectedModelComposite(selectedModel)
      }, 1000)
      

   }

   const getSelectedElements = async (pkgids) => {

      setLoadingElement(true)
      setSelectedElement(null)

      try {

         // Different models return different element properties when clicked in the viewer
         // IFC models return a string that matches an elements source_id
         // Revit models return an integer that maches an elements package_id
         // We try to guess what we get from the viewer and make the appropriate query
         let pkgidIsString = typeof pkgids[0] === 'string' || pkgids[0] instanceof String
         let pkgidIsNotANumber = isNaN(pkgids[0])

         let query
         if (pkgidIsString && pkgidIsNotANumber) {
            // IFC Specific Query
            query = { source_id: pkgids[0] }
            setSelection([pkgids[0]])
         } else {
            // all other bimpk format model query
            query = { package_id: parseInt(pkgids[0]) }
            setSelection([parseInt(pkgids[0])])
         }

         // get collections contained in the NamedCompositeItem representing the model
         let collectionsModelCompositeItem = (await IafItemSvc.getRelatedInItem(selectedModelComposite._userItemId, {}))._list

         // elements collection
         let elementCollection = collectionsModelCompositeItem.find(c => c._userType === 'rvt_elements')

         // element instance properties collection
         let elementPropCollection = collectionsModelCompositeItem.find(c => c._userType === 'rvt_element_props')

         // elements type properties collection
         let elementTypePropCollection = collectionsModelCompositeItem.find(c => c._userType === 'rvt_type_elements')

         // query the element collection as the parent
         // and follow relationships to the child instance and type properties
         let selectedModelElements = await IafScriptEngine.findWithRelated({
            parent: { 
               query: query,
               collectionDesc: {_userItemId: elementCollection._userItemId, _userType: elementCollection._userType},
            },
            related: [
               {
                  relatedDesc: { _relatedUserType: elementPropCollection._userType},
                  as: 'instanceProperties'
               },
               {
                  relatedDesc: { _relatedUserType: elementTypePropCollection._userType},
                  as: 'typeProperties'
               }
            ]
         })

         let userSelectedElement = selectedModelElements._list[0]
         if (userSelectedElement) {
            userSelectedElement.typeProperties = userSelectedElement.typeProperties._list.length ? userSelectedElement.typeProperties._list[0]?.properties : {}
            userSelectedElement.instanceProperties =  userSelectedElement.instanceProperties._list.length ? userSelectedElement.instanceProperties._list[0].properties : {}

            setSelectedElement(userSelectedElement)
         }
      } catch (err) {
         console.error("ERROR: Retrieving Selected Model Element")
         console.error(err)
      }

      setLoadingElement(false)

   }

   return <div className='simple-viewer-view'>
      <div className='viewer'>
         {selectedModelComposite && <IafViewerDBM
            ref={viewerRef} model={selectedModelComposite}
            serverUri={endPointConfig.graphicsServiceOrigin}
            sliceElementIds={sliceElementIds}
            colorGroups={colorGroups}
            selection={selection}
            OnSelectedElementChangeCallback={getSelectedElements}
         />}
      </div>
      <div className='viewer-sidebar'>
         <div>
            <label>Select a Model
               {!!availableModelComposites?.length && <select onChange={(e) => handleModelSelect(e.target.value)}>
                  <option value={0} disabled selected>Select a Model to View</option>
                  {availableModelComposites.sort((a,b) => a._name.localeCompare(b._name)).map(amc => <option key={amc._id} value={amc._id}>{amc._name}</option>)}
               </select>}
            </label>
         </div>
         {selectedModelComposite && <table className='element-info-table element-info-table-model'>
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
   
         <div className="element-info">
            {loadingElement && <SimpleTextThrobber throbberText='Loading Element Data' />}
            {selectedElement && <table className='element-info-table'>
               <tbody>
                  <tr>
                     <td className='prop-name'>_id</td>
                     <td>{selectedElement._id}</td>
                  </tr>
                  <tr>
                     <td className='prop-name'>Package Id</td>
                     <td>{selectedElement.package_id}</td>
                  </tr>
                  <tr>
                     <td className='prop-name'>Source Id</td>
                     <td>{selectedElement.source_id}</td>
                  </tr>
                  <tr>
                     <td colSpan='2' className='prop-type'>Type Properties</td>
                  </tr>
                  {Object.keys(selectedElement.typeProperties).sort().map((tp, i) => <tr key={`t${i}`}>
                     <td className='prop-name'>{selectedElement.typeProperties[tp].dName}</td>
                     <td>{selectedElement.typeProperties[tp].val}</td>
                  </tr>)}
                  <tr>
                     <td colSpan='2' className='prop-type'>Instance Properties</td>
                  </tr>
                  {Object.keys(selectedElement.instanceProperties).sort().map((ip, i) => <tr key={`t${i}`}>
                     <td className='prop-name'>{selectedElement.instanceProperties[ip].dName}</td>
                     <td>{selectedElement.instanceProperties[ip].val}</td>
                  </tr>)}
               </tbody>
            </table>}
         </div>
      </div>
   </div>

}

export default SimpleViewerView