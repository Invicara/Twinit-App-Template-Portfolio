// version dtf-1.0

import React, { useState, useEffect, useRef, useContext } from 'react'

// https://github.com/bvaughn/react-resizable-panels
import { Panel, PanelGroup } from "react-resizable-panels"
import ResizeHandle from './panels/TablePanelComponents/ResizeHandle'

import { IafViewerDBM } from '@dtplatform/iaf-viewer'
import { IafProj, IafItemSvc } from '@dtplatform/platform-api'
import { IafScriptEngine } from '@dtplatform/iaf-script-engine'

// collapasable drawer component provided by ipa-core
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls'

import ModelSelect from './ModelSelect/ModelSelect'
import SearchPane from './search/SearchPane'
import TablePanel from './panels/TablePanel'
import ElementDetails from './ElementDetails/ElementDetails'

import { ModelContext, ModelContextProvider } from './ModelContext'

import "@dtplatform/iaf-viewer/dist/iaf-viewer.css";
import './SimpleViewerView.scss'

const SimpleViewerView = (props) => {
   return <ModelContextProvider>
      <SimpleViewerPage />
   </ModelContextProvider>
}

const SimpleViewerPage = (props) => {

   // used to access viewer commands, not used in this example
   const viewerRef = useRef()

   const { 
      setSelectedModelComposite,
      selectedModelComposite,
      modelRelatedCollections,
      selectedElement,
      getSelectedElement,
      setSelectedPropRefs,
      sliceElements
   } = useContext(ModelContext)

   // the list of NamedCompositeItemns in the Item Service which represent imported models
   const [ availableModelComposites, setAvailableModelComposites ] = useState([])

   // the ids of the selected elements in the 3D/2D view
   // this example enforces single element selection by only ever assigning
   // one id to this array (or one element's worth of ids, package_id and source_id)
   // to account for differences between Revit and IFC bimpks
   const [ selection, setSelection ] = useState([])

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
      setSelectedModelComposite(undefined)

      // we need this timeout to give the IafViewer time to reset its own internal state
      // if we switch between models too quickly we get errors
      setTimeout(async () => {
         let selectedModel = availableModelComposites.find(amc => amc._id === modelCompositeId)
         setSelectedModelComposite(selectedModel)
      }, 1000)
      
   }

   const selectElement = (element) => {

      setSelectedElement([])
      setSelection([parseInt(element.package_id), element.source_id])
      setSelectedElement(element)

   }

   const setSelectedElement = async (pkgids) => {

      getSelectedElement(pkgids)

   }

   return <div className='simple-viewer-view'>
      
         <PanelGroup autoSaveId="elemtable" direction="vertical">
            <Panel id="viewer-panel" collapsible={false} order={1}>
               <div className="panel-row">
                  <StackableDrawer level={1} iconKey='fa-search' tooltip='Search'>
                     <div className='viewer-sidebar'>
                        
                        <ModelSelect availableModels={availableModelComposites} onModelSelect={handleModelSelect} />
                        {selectedModelComposite && modelRelatedCollections && <SearchPane onPropertyChange={setSelectedPropRefs} />}
                  
                     </div>
                  </StackableDrawer>
                  <StackableDrawer level={2} iconKey='fa-info' tooltip='Element' isDrawerOpen={false}>
                     <div className='viewer-sidebar'>
                        
                        {!selectedElement && <div className='no-element-selected'>No Element Selected</div>}
                        {selectedElement && <ElementDetails element={selectedElement} horizontal={false} />}
                        
                     </div>
                  </StackableDrawer>
                  <div className='viewer'>
                     {selectedModelComposite && <IafViewerDBM
                        ref={viewerRef} model={selectedModelComposite}
                        serverUri={endPointConfig.graphicsServiceOrigin}
                        sliceElementIds={sliceElements.map(se => [se.package_id, se.source_id]).flat()}
                        selection={selection}
                        OnSelectedElementChangeCallback={setSelectedElement}
                     />}
                  </div>
                  
               </div>
            </Panel>
            <ResizeHandle />
            <Panel id="table-panel" collapsible={true} order={2} defaultSize={1} className='table-panel'>
               <TablePanel />
            </Panel>
         </PanelGroup>

   </div>

}

export default SimpleViewerView