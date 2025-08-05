import React, { useRef, useContext, useState, useCallback, useMemo, useEffect } from "react";
import _ from 'lodash';

import { ModelContext, ModelContextProvider } from "../../contexts/ModelContext";
import { IafViewerDBM } from '@dtplatform/iaf-viewer';
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls';

import CompareView from "./CompareView";
import { Panel, PanelGroup } from "react-resizable-panels";

import "./ModelComparisonView.scss";

const ModelComparisonView = (props) => {
    return <ModelContextProvider>
        <ModelComparisonPage {...props} />
    </ModelContextProvider>
};

const ModelComparisonPage = () => {
    const viewerOne = useRef();
    const viewerTwo = useRef();

    const [cameraState, setCameraState] = useState(undefined);
    const [selectOne, setSelectOne] = useState("");
    const [selectTwo, setSelectTwo] = useState("");
    const [modelOne, setModelOne] = useState(null);
    const [modelTwo, setModelTwo] = useState(null);
    const [cameraSyncEnabled, setCameraSyncEnabled] = useState(true);

    const handleCameraUpdate = useCallback((camera) => {
        setCameraState(prev => {
            const isChanged = JSON.stringify(camera) !== JSON.stringify(prev);
            return isChanged ? camera : prev;
        });
    }, []);

    const viewerCamera = useMemo(() => ({
        enable: true,
        showToolbar: false,
        camera: cameraState,
        onCameraUpdate: {
            delay: 300,
            callback: cameraSyncEnabled ? handleCameraUpdate : null,
        }
    }), [cameraState, handleCameraUpdate, cameraSyncEnabled]);

    const { availableModelComposites } = useContext(ModelContext);

    useEffect(() => {
        if (Array.isArray(availableModelComposites) && selectOne !== "") {
            setModelOne(availableModelComposites.find(item => item._name === selectOne));
        }
    }, [selectOne, availableModelComposites]);

    useEffect(() => {
        if (Array.isArray(availableModelComposites) && selectTwo !== "") {
            setModelTwo(availableModelComposites.find(item => item._name === selectTwo));
        }
    }, [selectTwo, availableModelComposites]);

    return (
        availableModelComposites && availableModelComposites.length > 1 && (
            <div className="viewerWrapper">
                <PanelGroup autoSaveId="modelComp" direction="vertical">
                    <Panel id="model-comp-panel" collapsible={false} order={1}>
                        <div className="panel-row">
                            <StackableDrawer level={1} iconKey='fa-search' tooltip='Search'>
                                <div className='viewer-sidebar'>
                                    <label htmlFor="model-one" className="model-select-label">Select Model One:</label>
                                    <select id="model-one" value={selectOne} onChange={(e) => setSelectOne(e.target.value)}>
                                        <option value="">--Please choose an option--</option>
                                        {availableModelComposites.map(({ _name }, key) => <option key={key} value={_name}>{_name}</option>)}
                                    </select>
                                </div>
                                <div className='viewer-sidebar'>
                                    <label htmlFor="model-two" className="model-select-label">Select Model Two:</label>
                                    <select id="model-two" value={selectTwo} onChange={(e) => setSelectTwo(e.target.value)}>
                                        <option value="">--Please choose an option--</option>
                                        {availableModelComposites.map(({ _name }, key) => <option key={key} value={_name}>{_name}</option>)}
                                    </select>
                                </div>
                                <div className="viewer-sidebar">
                                    <label htmlFor="camera-synch" className="synch-check">Enable Camera Sync</label>
                                    <input
                                        id="camera-synch"
                                        type="checkbox"
                                        checked={cameraSyncEnabled}
                                        onChange={() => setCameraSyncEnabled(prev => !prev)}
                                    />
                                </div>
                            </StackableDrawer>
                            {modelOne && modelTwo &&
                                <div className="viewers">
                                    <CompareView>
                                        <IafViewerDBM
                                            ref={viewerOne}
                                            serverUri={endPointConfig.graphicsServiceOrigin}
                                            model={modelOne}
                                            modelVersionId={modelOne._versions[0]._id}
                                            sliceElementIds={[]}
                                            highlightedElementIds={[]}
                                            isolatedElementIds={[]}
                                            spaceElementIds={[]}
                                            selection={[]}
                                            OnSelectedElementChangeCallback={(e) => { console.log(e) }}
                                            title={"Left Model"}
                                            view3d={viewerCamera}
                                            view2d={{
                                                enable: false
                                            }}
                                        />
                                        <IafViewerDBM
                                            ref={viewerTwo}
                                            serverUri={endPointConfig.graphicsServiceOrigin}
                                            model={modelTwo}
                                            modelVersionId={modelTwo._versions[0]._id}
                                            sliceElementIds={[]}
                                            highlightedElementIds={[]}
                                            isolatedElementIds={[]}
                                            spaceElementIds={[]}
                                            selection={[]}
                                            OnSelectedElementChangeCallback={(e) => { console.log(e) }}
                                            title={"Right Model"}
                                            view3d={viewerCamera}
                                            view2d={{
                                                enable: false
                                            }}
                                        />
                                    </CompareView>
                                </div>
                            }
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        )
    );

}

export default ModelComparisonView;
