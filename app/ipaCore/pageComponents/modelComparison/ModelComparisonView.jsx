import React, { useRef, useContext, useState, useCallback, useMemo } from "react";

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
    const viewer = useRef();

    const [cameraState, setCameraState] = useState(undefined);

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
            callback: handleCameraUpdate,
        }
    }), [cameraState, handleCameraUpdate]);

    const { availableModelComposites } = useContext(ModelContext);

    return (
        availableModelComposites && availableModelComposites.length > 1 && (
            <div className="viewerWrapper">
                <PanelGroup autoSaveId="modelComp" direction="vertical">
                    <Panel id="model-comp-panel" collapsible={false} order={1}>
                        <div className="panel-row">
                            <StackableDrawer level={1} iconKey='fa-search' tooltip='Search'>
                                <div className='viewer-sidebar'>
                                    <p>Test</p>
                                </div>
                            </StackableDrawer>
                            <div className="viewers">
                                <CompareView>
                                    <IafViewerDBM
                                        ref={viewer}
                                        serverUri={endPointConfig.graphicsServiceOrigin}
                                        model={availableModelComposites[0]}
                                        modelVersionId={availableModelComposites[0]._versions[0]._id}
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
                                        ref={viewer}
                                        serverUri={endPointConfig.graphicsServiceOrigin}
                                        model={availableModelComposites[1]}
                                        modelVersionId={availableModelComposites[1]._versions[0]._id}
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
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        )
    );

}

export default ModelComparisonView;
