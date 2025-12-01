import React, { useRef, useContext, useState, useEffect } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import ResizeHandle from '../../components/panels/ResizeHandle'
import { IafViewerDBM } from '@dtplatform/iaf-viewer'
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls'

import ModelSelect from '../../components/ModelSelect/ModelSelect'
import SearchPane from '../../components/search/SearchPane'
import ElementDetails from '../../components/ElementDetails/ElementDetails'
import ModelDocs from '../../components/ModelDocs/ModelDocs'
import EquipmentDetails from '../../components/EquipmentDetails/EquipmentDetails'
import FloatingModelDocViewer from '../../components/FloatingDocViewer/FloatingModelDocViewer'
import { getTemporaryMapBoxToken } from '../utils/mapboxUtils'
import { ModelContext } from '../../contexts/ModelContext'
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward'
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward'

import ViewerBottomPanel from './panels/ViewerBottomPanel'

import '@dtplatform/iaf-viewer/dist/iaf-viewer.css'
import './SimpleViewerView.scss'
const dataExample = [
  {
    _id: "68d64f9771aa127e59875140",
    "revision status date": "2010-09-12T00:00:00Z",
    "revision status": "ISSUED",
    equipmentId: "RCP-900-014",
    properties: {
      Manufacturer: { val: "Westinghouse", type: "string" },
      Model: { val: "RCP-900", type: "string" },
      "Safety Class": { val: "Class 1", type: "string" },
      "Operating Status": { val: "Operational", type: "string" },
      "Operational Status Date": { val: "2024-10-25T00:00:00Z", type: "date" },
    },
    revision: "001",
    TechnicalParameters: {
      FlowRate: { val: 2100, type: "number", unit: "gpm" },
      Power: { val: 10, type: "number", unit: "MW" },
    },
    siteEquipmentId: "RCP-A-024",
    equipmentType: "Pump",
  },
  {
    _id: "68d64f9771aa127e59875142",
    "revision status date": "2019-11-28T00:00:00Z",
    "revision status": "ISSUED",
    equipmentId: "RCP-900-011",
    properties: {
      Manufacturer: { val: "KSB", type: "string" },
      Model: { val: "RSR", type: "string" },
      "Safety Class": { val: "Class 1", type: "string" },
      "Operating Status": { val: "Operational", type: "string" },
      "Operational Status Date": { val: "2024-10-25T00:00:00Z", type: "date" },
    },
    revision: "002",
    TechnicalParameters: {
      FlowRate: { val: 2800, type: "number", unit: "gpm" },
      Power: { val: 18, type: "number", unit: "MW" },
    },
    siteEquipmentId: "RCP-A-021",
    equipmentType: "Pump",
  },
  {
    _id: "68d64f9771aa127e59875143",
    "revision status date": "2019-11-28T00:00:00Z",
    "revision status": "ISSUED",
    equipmentId: "RCP-900-012",
    properties: {
      Manufacturer: { val: "KSB", type: "string" },
      Model: { val: "RSR", type: "string" },
      "Safety Class": { val: "Class 1", type: "string" },
      "Operating Status": { val: "Operational", type: "string" },
      "Operational Status Date": { val: "2024-10-25T00:00:00Z", type: "date" },
    },
    revision: "002",
    TechnicalParameters: {
      FlowRate: { val: 2800, type: "number", unit: "gpm" },
      Power: { val: 18, type: "number", unit: "MW" },
    },
    siteEquipmentId: "RCP-A-022",
    equipmentType: "Pump",
  },
];

const SimpleViewerView = ({ handler }) => {
  const viewerRef = useRef()

  const {
    selectedModelComposite,
    selectedModelCompositeVersion,
    modelRelatedCollections,
    selectedElement,
    getSelectedElement,
    setSelectedPropRefs,
    sliceElements,
    isBottomECPanelOpen,
    setBottomECPanelIsOpen,
  } = useContext(ModelContext)

  const panelControl = () => {
    setBottomECPanelIsOpen(!isBottomECPanelOpen)
  }

const [isAnyDrawerOpen, setIsAnyDrawerOpen] = useState(false);

useEffect(() => {
  const observer = new MutationObserver(() => {
    // check if any drawer content is open
    const anyOpen = !!document.querySelector('.drawer .drawer-content-open');
    setIsAnyDrawerOpen(anyOpen);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  return () => observer.disconnect();
}, []);



  const [docView, setDocView] = useState()
  const [mapboxToken, setMapboxToken] = useState()
  const [modelComposition, setModelComposition] = useState({
    initial: {
      Structural: true,
      Architectural: true,
      Mechanical: true,
      Electrical: true,
      Plumbing: true,
      FireProtection: true,
      Infrastructural: true,
    },
  })

  useEffect(() => {
    getMapboxToken()
  }, [])

  const getMapboxToken = async () => {
    let token = await getTemporaryMapBoxToken()
    if (token) setMapboxToken(token)
  }

  return (
    <div className='simple-viewer-view'>
      {docView && (
        <FloatingModelDocViewer
          docIds={[docView]}
          onClose={() => setDocView(null)}
        />
      )}
      <PanelGroup autoSaveId='elemtable' direction='vertical'>
        <Panel id='viewer-panel' collapsible={false} order={1}>
          <div className='panel-row'>
            <StackableDrawer level={1} iconKey='fa-search' tooltip='Search'>
              <div className='viewer-sidebar'>
                <ModelSelect />
                {selectedModelComposite && modelRelatedCollections && (
                  <SearchPane onPropertyChange={setSelectedPropRefs} />
                )}
              </div>
            </StackableDrawer>

            <StackableDrawer
              level={2}
              iconKey='fa-info'
              tooltip='Element'
              isDrawerOpen={false}
            >
              <div className='viewer-sidebar'>
                {!selectedElement && (
                  <div className='no-element-selected'>
                    No Element Selected
                  </div>
                )}
                {selectedElement && (
                  <ElementDetails
                    element={selectedElement}
                    horizontal={false}
                    readOnly={!handler?.config?.manageFiles}
                    onView={(docInfo) => setDocView(docInfo)}
                  />
                )}
              </div>
            </StackableDrawer>

            <StackableDrawer
              level={3}
              iconKey='fa-file-alt'
              tooltip='Files'
              isDrawerOpen={false}
            >
              <div className='viewer-sidebar'>
                {!selectedModelComposite && (
                  <div className='no-element-selected'>No Model Selected</div>
                )}
                {selectedModelComposite && (
                  <ModelDocs
                    onView={(docInfo) => setDocView(docInfo)}
                    readOnly={!handler?.config?.manageFiles}
                  />
                )}
              </div>
            </StackableDrawer>

            <div className='viewer'>
              {selectedModelComposite && selectedModelCompositeVersion && (
                <IafViewerDBM
                  ref={viewerRef}
                  model={{
                    ...selectedModelComposite,
                    _versions: [selectedModelCompositeVersion],
                  }}
                  serverUri={endPointConfig.graphicsServiceOrigin}
                  sliceElementIds={sliceElements
                    .map((se) => [se.package_id, se.source_id])
                    .flat()}
                  selection={
                    selectedElement
                      ? [selectedElement.package_id, selectedElement.source_id]
                      : []
                  }
                  OnSelectedElementChangeCallback={getSelectedElement}
                  modelComposition={modelComposition}
                  enableOptimizedSelection={true}
                  gis={{
                    enabled: !!mapboxToken,
                    token: mapboxToken,
                  }}
                />
              )}
              <div
                className={`viewer-bottom-panel-header ${
                  !isBottomECPanelOpen ? 'closed' : ''
                }`}
              >
                {isBottomECPanelOpen ? (
                  <ArrowDownwardIcon
                    style={{ color: '#5D5D5D', cursor: 'pointer' }}
                    onClick={panelControl}
                  />
                ) : (
                  <ArrowUpwardIcon
                    style={{ color: '#5D5D5D', cursor: 'pointer' }}
                    onClick={panelControl}
                  />
                )}
              </div>
              <ViewerBottomPanel isBottomECPanelOpen={isBottomECPanelOpen} items={dataExample} isSidePanelOpen={isAnyDrawerOpen}/>
            </div>
          </div>
        </Panel>
        <ResizeHandle />
      </PanelGroup>
    </div>
  )
}

export default SimpleViewerView