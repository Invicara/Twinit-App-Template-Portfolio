
import React, { useRef, useContext } from 'react'

// https://github.com/bvaughn/react-resizable-panels
import { Panel, PanelGroup } from "react-resizable-panels"
import ResizeHandle from './panels/TablePanelComponents/ResizeHandle'

import { IafViewerDBM } from '@dtplatform/iaf-viewer'

// collapasable drawer component provided by ipa-core
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls'

import ModelSelect from './ModelSelect/ModelSelect'
import SearchPane from './search/SearchPane'
import TablePanel from './panels/TablePanel'
import ElementDetails from './ElementDetails/ElementDetails'

import { ModelContext, ModelContextProvider } from './ModelContext'

import "@dtplatform/iaf-viewer/dist/iaf-viewer.css";
import './SimpleViewerView.scss'


const SimpleViewerView = () => {
   return <ModelContextProvider>
      <SimpleViewerPage />
   </ModelContextProvider>
}

const SimpleViewerPage = () => {

   // used to access viewer commands, not used in this example
   const viewerRef = useRef()

   const {
      selectedModelComposite,
      modelRelatedCollections,
      selectedElement,
      getSelectedElement,
      setSelectedPropRefs,
      sliceElements
   } = useContext(ModelContext)

   return <div className='simple-viewer-view'>
      
         <PanelGroup autoSaveId="elemtable" direction="vertical">
            <Panel id="viewer-panel" collapsible={false} order={1}>
               <div className="panel-row">
                  <StackableDrawer level={1} iconKey='fa-search' tooltip='Search'>
                     <div className='viewer-sidebar'>
                        
                        <ModelSelect />
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
                        selection={selectedElement? [selectedElement.package_id, selectedElement.source_id] : []}
                        OnSelectedElementChangeCallback={getSelectedElement}
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