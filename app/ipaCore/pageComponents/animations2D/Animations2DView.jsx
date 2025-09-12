import React, { useRef, useContext } from 'react';
import { Panel, PanelGroup } from "react-resizable-panels";

import { IafViewerDBM } from '@dtplatform/iaf-viewer';
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls';

import ModelSelect from '../../components/ModelSelect/ModelSelect';
import { ModelContext } from '../../contexts/ModelContext';

const Animations2DView = (props) => {
    return <Animations2DPage {...props} />
};

const Animations2DPage = () => {
    const viewerRef = useRef();

    const {
        selectedModelComposite,
        selectedModelCompositeVersion,
    } = useContext(ModelContext);

    // Create a script to populate Item Service with below
    // Put animation templates in the Item Service

    // Fetch an animation based on its type
    // Populate the workflow accordingly
    // Populate the elemetnId in the component

    return (
        <div className='simple-viewer-view'>
            <PanelGroup autoSaveId="elemtable" direction="vertical">
                <Panel id="viewer-panel" collapsible={false} order={1}>
                    <div className="panel-row">
                        <StackableDrawer level={1} iconKey='fa-search' tooltip='Search'>
                            <div className='viewer-sidebar'>
                                <ModelSelect />
                            </div>
                        </StackableDrawer>
                        <div className='viewer'>
                            {
                                selectedModelComposite && selectedModelCompositeVersion && (
                                    <IafViewerDBM
                                        ref={viewerRef}
                                        model={{ ...selectedModelComposite, _versions: [selectedModelCompositeVersion] }}
                                        serverUri={endPointConfig.graphicsServiceOrigin}
                                        enableOptimizedSelection={true}
                                        workflow={{
                                            active: 5,
                                            list: [
                                                {
                                                    uuid: 5,
                                                    timeInSeconds: 4.5,
                                                    loop: true,
                                                    script: [
                                                        {
                                                            uuid: 'wf-3.markup.circle.813',
                                                            elementIds: [2383],
                                                            type: "Markup",
                                                            frames: [
                                                                {
                                                                    type: "Circle",
                                                                    status: "Error",
                                                                    blink: true,
                                                                    scale: 1.5
                                                                },
                                                            ]
                                                        },
                                                        // {
                                                        //     uuid: 'wf-3.markup.circle.814',
                                                        //     elementIds: [170],
                                                        //     type: "Markup",
                                                        //     frames: [
                                                        //         {
                                                        //             type: "Circle",
                                                        //             status: "Error",
                                                        //             blink: true,
                                                        //             scale: 1.5
                                                        //         }
                                                        //     ]
                                                        // },
                                                        // {
                                                        //     uuid: 'Sprite.Test',
                                                        //     elementIds: [87],
                                                        //     type: "Sprite",
                                                        //     frames: [
                                                        //         {
                                                        //             type: "Gif",
                                                        //             size: 5,
                                                        //             image: "/icons/test.gif",
                                                        //             alignment: "Center",
                                                        //             autoScale: true
                                                        //         }
                                                        //     ]
                                                        // },
                                                    ]
                                                },
                                            ]
                                        }}
                                    />
                                )
                            }
                        </div>
                    </div>
                </Panel>
            </PanelGroup>
        </div>
    );
}

export default Animations2DView;
