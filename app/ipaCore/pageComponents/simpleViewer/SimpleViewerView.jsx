
import React, { useRef, useContext, useState, useEffect } from 'react'

// https://github.com/bvaughn/react-resizable-panels
import { Panel, PanelGroup } from "react-resizable-panels"
import ResizeHandle from '../../components/panels/ResizeHandle'

import { IafViewerDBM } from '@dtplatform/iaf-viewer'

// collapasable drawer component provided by ipa-core
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls'

import ModelSelect from '../../components/ModelSelect/ModelSelect'
import SearchPane from '../../components/search/SearchPane'
import ElementDetails from '../../components/ElementDetails/ElementDetails'
import ModelDocs from '../../components/ModelDocs/ModelDocs'

import FloatingModelDocViewer from '../../components/FloatingDocViewer/FloatingModelDocViewer'

// Mapbox utilities to support Mapbox in the viewer
import { getTemporaryMapBoxToken } from '../utils/mapboxUtils'

import { ModelContext, ModelContextProvider } from '../../contexts/ModelContext'

import TablePanel from './panels/TablePanel'

import "@dtplatform/iaf-viewer/dist/iaf-viewer.css";
import './SimpleViewerView.scss'


const SimpleViewerView = (props) => {
   return <ModelContextProvider>
      <SimpleViewerPage {...props} />
   </ModelContextProvider>
}

const SimpleViewerPage = ({ handler }) => {

   // used to access viewer commands, not used in this example
   const viewerRef = useRef()

   const {
      selectedModelComposite,
      selectedModelCompositeVersion,
      modelRelatedCollections,
      selectedElement,
      getSelectedElement,
      setSelectedPropRefs,
      sliceElements
   } = useContext(ModelContext)

   // the file _id and version _id of the file to display in the document viewer
   // the doc viewer renders if this has a value
   const [docView, setDocView] = useState()

   // the Mapbox token to nable GIS features in the IafViewer
   const [mapboxToken, setMapboxToken] = useState()

   // model composition settings to load all trades when model loads
   // otherwise the viewer will try to guess on its own
   // making state with the intent of adding configuraton UI in the future
   const [modelComposition, setModelComposition] = useState({
      initial: {
         Structural: true,
         Architectural: true,
         Mechanical: true,
         Electrical: true,
         Plumbing: true,
         FireProtection: true,
         Infrastructural: true
      }
   })

   useEffect(() => {

      // to enable mapbox in the IafViewer
      getMapboxToken()

   }, [])

   const getMapboxToken = async () => {
      let token = await getTemporaryMapBoxToken()

      if (token) {
         setMapboxToken(token)
      }

   }

   return <div className='simple-viewer-view'>
      {docView && <FloatingModelDocViewer
         docIds={[docView]}
         onClose={() => setDocView(null)}
      />}
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
                     {selectedElement && <ElementDetails element={selectedElement} horizontal={false} readOnly={!handler?.config?.manageFiles} onView={(docInfo) => setDocView(docInfo)} />}

                  </div>
               </StackableDrawer>
               <StackableDrawer level={3} iconKey='fa-file-alt' tooltip='Files' isDrawerOpen={false}>
                  <div className='viewer-sidebar'>

                     {!selectedModelComposite && <div className='no-element-selected'>No Model Selected</div>}
                     {selectedModelComposite && <ModelDocs onView={(docInfo) => setDocView(docInfo)} readOnly={!handler?.config?.manageFiles} />}

                  </div>
               </StackableDrawer>
               <div className='viewer'>
                  {selectedModelComposite && selectedModelCompositeVersion && <IafViewerDBM
                     ref={viewerRef}
                     model={{ ...selectedModelComposite, _versions: [selectedModelCompositeVersion] }}
                     serverUri={endPointConfig.graphicsServiceOrigin}
                     sliceElementIds={sliceElements.map(se => [se.package_id, se.source_id]).flat()}
                     selection={selectedElement ? [selectedElement.package_id, selectedElement.source_id] : []}
                     OnSelectedElementChangeCallback={getSelectedElement}
                     modelComposition={modelComposition}
                     enableOptimizedSelection={true}
                     gis={{
                        enabled: !!mapboxToken,
                        token: mapboxToken
                     }}
                  />}
               </div>

            </div>
         </Panel>
         <ResizeHandle />
         <Panel id="table-panel" collapsible={true} order={2} defaultSize={1} className='table-panel'>
            <TablePanel
               readOnly={!handler?.config?.manageFiles}
               onView={(docInfo) => setDocView(docInfo)}
            />
         </Panel>
      </PanelGroup>

   </div>

}

export default SimpleViewerView
