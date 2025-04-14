
import React, { useRef, useState, useEffect, useContext } from 'react'

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

   const [ selectedModelCompositeVersionLeft, setselectedModelCompositeVersionLeft ] = useState()

   const [ selectedElementLeft, setSelectedElementLeft ] = useState()

   const {
      selectedModelComposite,
      loadModelCollections,
      selectedModelCompositeVersions,
      selectedModelCompositeVersion,
      modelRelatedCollections,
      selectedElement,
      getSelectedElement,
      setSelectedPropRefs,
      sliceElements
   } = useContext(ModelContext)

   useEffect(() => {

      //getSelectedElementLeft()

   }, [selectedElement])

   const onCompareSelect = (version) => {

      setselectedModelCompositeVersionLeft(null)

      setTimeout(() => {
         setselectedModelCompositeVersionLeft(selectedModelCompositeVersions.find(ver => ver._version === parseInt(version)) )
      }, 1000)
      

   }

   const getSelectedElementLeft = async (pkgIds) => {

      let leftVerModelCollections = await loadModelCollections(selectedModelCompositeVersionLeft._id)
      console.log('leftVerModelCollections', leftVerModelCollections)
      let leftSelectedElement = await getSelectedElement(pkgIds, leftVerModelCollections)
      console.log('leftSelectedElement', leftSelectedElement)
      setSelectedElementLeft(leftSelectedElement)
   }

   return <div className='simple-compare-view'>
      <div className="panel-row">
         <StackableDrawer level={1} iconKey='fa-search' tooltip='Search'>
            <div className='viewer-sidebar'>
               
               <ModelSelect />
               <div>
                  <div>
                  {selectedModelCompositeVersions?.length && selectedModelCompositeVersion && <label>Version to Compare
                     <select onChange={(e) => onCompareSelect(e.target.value)} value={selectedModelCompositeVersionLeft?._version || undefined}>
                        <option value={0} disabled selected>Select a Model Version</option>
                        {selectedModelCompositeVersions.map(v => v._version).sort().reverse().filter(ver => ver !== selectedModelCompositeVersion._version).map(ver => <option key={ver} value={ver}>{ver}</option>)}
                     </select>
                     </label>}
                  </div>
               </div>
               {selectedModelComposite && modelRelatedCollections && <SearchPane onPropertyChange={setSelectedPropRefs} />}
         
            </div>
         </StackableDrawer>
         <StackableDrawer level={2} iconKey='fa-arrow-left' tooltip='Element' isDrawerOpen={false}>
            <div className='viewer-sidebar'>
               
               {!selectedElementLeft && <div className='no-element-selected'>No Element Selected</div>}
               {selectedElementLeft && <ElementDetails element={selectedElementLeft} horizontal={false} />}
               
            </div>
         </StackableDrawer>
         <StackableDrawer level={3} iconKey='fa-arrow-right' tooltip='Element' isDrawerOpen={false}>
            <div className='viewer-sidebar'>
               
               {!selectedElement && <div className='no-element-selected'>No Element Selected</div>}
               {selectedElement && <ElementDetails element={selectedElement} horizontal={false} />}
               
            </div>
         </StackableDrawer>
      </div>
      
         <PanelGroup autoSaveId="viewer-comp" direction="horizontal">
            <Panel id="viewer-panel-old" collapsible={true} order={1}>

               
                  
                  
                  <div className='viewer'>
                     {selectedModelComposite && selectedModelCompositeVersionLeft && <IafViewerDBM
                        ref={viewerRef}
                        model={{...selectedModelComposite, _versions: [selectedModelCompositeVersionLeft]}}
                        serverUri={endPointConfig.graphicsServiceOrigin}
                        sliceElementIds={sliceElements.map(se => [se.package_id, se.source_id]).flat()}
                        selection={selectedElementLeft ? [selectedElementLeft.package_id, selectedElementLeft.source_id] : []}
                        OnSelectedElementChangeCallback={getSelectedElementLeft}
                     />}
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
                        selection={selectedElement ? [selectedElement.package_id, selectedElement.source_id] : []}
                        OnSelectedElementChangeCallback={getSelectedElement}
                     />}
                  </div>
          
            </Panel>
         </PanelGroup>

   </div>

}

export default SimpleCompareView