
import React, { useRef, useState,useContext } from 'react'

// https://github.com/bvaughn/react-resizable-panels
import { Panel, PanelGroup } from "react-resizable-panels"
import ResizeHandle from '../../components/panels/ResizeHandle'

import { IafViewerDBM } from '@dtplatform/iaf-viewer'

// collapasable drawer component provided by ipa-core
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls'

import ModelSelect from '../../components/ModelSelect/ModelSelect'
import SearchPane from '../../components/search/SearchPane'
import ElementDetails from '../../components/ElementDetails/ElementDetails'

import { ModelContext, ModelContextProvider } from '../../contexts/ModelContext'

import "@dtplatform/iaf-viewer/dist/iaf-viewer.css";
import './SimpleCompareView.scss'


const SimpleCompareView = () => {
   return <ModelContextProvider>
      <SimpleCompPage />
   </ModelContextProvider>
}

const SimpleCompPage = () => {

   // used to access viewer commands, not used in this example
   const viewerRef = useRef()
   const viewerRefLeft = useRef()

   const [ selectedModelCompositeVersionOld, setSelectedModelCompositeVersionOld ] = useState()

   const {
      selectedModelComposite,
      selectedModelCompositeVersions,
      selectedModelCompositeVersion,
      modelRelatedCollections,
      selectedElement,
      getSelectedElement,
      setSelectedPropRefs,
      sliceElements
   } = useContext(ModelContext)

   const onCompareSelect = (version) => {

      console.log()
      let leftVer = selectedModelCompositeVersions.find(ver => ver._version === parseInt(version)) 
      console.log(selectedModelCompositeVersions, version, leftVer)
      setSelectedModelCompositeVersionOld(leftVer)

   }

   return <div className='simple-viewer-view'>
      
      
         <PanelGroup autoSaveId="viewer-comp" direction="horizontal">
            <Panel id="viewer-panel-old" collapsible={true} order={1}>

               <div className="panel-row">
                  <StackableDrawer level={1} iconKey='fa-search' tooltip='Search'>
                     <div className='viewer-sidebar'>
                        
                        <ModelSelect />
                        <div>
                           <div>
                           {selectedModelCompositeVersions?.length && selectedModelCompositeVersion && <label>Version to Compare
                              <select onChange={(e) => onCompareSelect(e.target.value)} value={selectedModelCompositeVersionOld?._version || undefined}>
                                 <option value={0} disabled selected>Select a Model Version</option>
                                 {selectedModelCompositeVersions.map(v => v._version).sort().reverse().filter(ver => ver !== selectedModelCompositeVersion._version).map(ver => <option key={ver} value={ver}>{ver}</option>)}
                              </select>
                              </label>}
                           </div>
                        </div>
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
                     {selectedModelComposite && selectedModelCompositeVersionOld && <IafViewerDBM
                        ref={viewerRef}
                        model={{...selectedModelComposite, _versions: [selectedModelCompositeVersionOld]}}
                        serverUri={endPointConfig.graphicsServiceOrigin}
                        sliceElementIds={sliceElements.map(se => [se.package_id, se.source_id]).flat()}
                        selection={selectedElement? [selectedElement.package_id, selectedElement.source_id] : []}
                        OnSelectedElementChangeCallback={getSelectedElement}
                     />}
                  </div>
               </div>

            </Panel>
            <ResizeHandle className='horizontal' />
            <Panel id="viewer-panel-new" collapsible={true} order={2} >

                  <div className='viewer'>
                     {selectedModelComposite && selectedModelCompositeVersion && <IafViewerDBM
                        ref={viewerRefLeft}
                        model={{...selectedModelComposite, _versions: [selectedModelCompositeVersion]}}
                        serverUri={endPointConfig.graphicsServiceOrigin}
                        sliceElementIds={sliceElements.map(se => [se.package_id, se.source_id]).flat()}
                        selection={selectedElement? [selectedElement.package_id, selectedElement.source_id] : []}
                        OnSelectedElementChangeCallback={getSelectedElement}
                     />}
                  </div>
          
            </Panel>
         </PanelGroup>

   </div>

}

export default SimpleCompareView