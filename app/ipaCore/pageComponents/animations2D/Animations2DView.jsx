import React, { useRef, useState, useContext } from 'react';
import { Panel, PanelGroup } from "react-resizable-panels";

import { IafViewerDBM } from '@dtplatform/iaf-viewer';
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls';

import ModelSelect from '../../components/ModelSelect/ModelSelect';
import { ModelContext } from '../../contexts/ModelContext';

const Animations2DView = (props) => {
    return <Animations2DPage {...props} />
};

const Animations2DPage = () => {
    const [workflow, setWorkflow] = useState(null);

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
                                        workflow={workflow}
                                        OnViewerReadyCallback={(model) => {
                                            if (model === '2d') {
                                                setWorkflow({
                                                    active: 5,
                                                    list: [
                                                        {
                                                            uuid: 5,
                                                            timeInSeconds: 4.5,
                                                            loop: true,
                                                            script: [
                                                                {
                                                                    uuid: "lab_warning_1503",
                                                                    elementIds: [203, 204, 201],
                                                                    type: "Color",
                                                                    frames: [
                                                                        { r: 200, g: 0, b: 0 },
                                                                        { r: 200, g: 200, b: 200 },
                                                                        { r: 200, g: 0, b: 0 },
                                                                        { r: 200, g: 200, b: 200 },
                                                                    ],
                                                                },
                                                                {
                                                                    uuid: 'sprite_warning_gif_161',
                                                                    elementIds: [161],
                                                                    type: "Sprite",
                                                                    frames: [
                                                                        {
                                                                            type: "Gif",
                                                                            size: 1,
                                                                            image: "/icons/warning-sign.gif",
                                                                            alignment: "Center",
                                                                            autoScale: true,
                                                                        }
                                                                    ]
                                                                },
                                                                {
                                                                    uuid: "patient_bed_move_2362",
                                                                    elementIds: [2362],
                                                                    type: "Translation",
                                                                    frames: [
                                                                        { x: 0, y: 0, z: 0, interpolationType: "CubicSpline" },
                                                                        { x: 0, y: -4, z: 0, interpolationType: "CubicSpline" },
                                                                        { x: 0, y: -4, z: 0, interpolationType: "CubicSpline" },
                                                                        { x: 13, y: -4, z: 0, interpolationType: "CubicSpline" },
                                                                        { x: 13, y: -20, z: 0, interpolationType: "CubicSpline" },
                                                                        { x: 0, y: -20, z: 0, interpolationType: "ConCubicSplinestant" }
                                                                    ],
                                                                },
                                                                {
                                                                    uuid: "patient_bed_color_2362",
                                                                    elementIds: [2362],
                                                                    type: "Color",
                                                                    frames: [
                                                                        { r: 0, g: 200, b: 0 },
                                                                        { r: 200, g: 200, b: 200 },
                                                                        { r: 0, g: 200, b: 0 },
                                                                        { r: 200, g: 200, b: 200 },
                                                                    ],
                                                                },
                                                                {
                                                                    uuid: 'circle_2383',
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
                                                                {
                                                                    uuid: "opacity_2398",
                                                                    elementIds: [2398],
                                                                    type: "Opacity",
                                                                    frames: [
                                                                        { opacity: 0, interpolationType: "Linear" },
                                                                        { opacity: 0.2, interpolationType: "Linear" },
                                                                        { opacity: 0.4, interpolationType: "Linear" },
                                                                        { opacity: 0.6, interpolationType: "Linear" },
                                                                        { opacity: 0.8, interpolationType: "Linear" },
                                                                        { opacity: 1, interpolationType: "Linear" }
                                                                    ]
                                                                },
                                                                {
                                                                    uuid: 'text_2324',
                                                                    elementIds: [2324],
                                                                    type: "Markup",
                                                                    frames: [
                                                                        {
                                                                            type: "Text",
                                                                            text: "Entrance",
                                                                            blink: true,
                                                                            strokeColor: { r: 0, g: 0, b: 0 },
                                                                            fillColor: { r: 100, g: 100, b: 250 },
                                                                            shiftPercent: {x: -30, y: 20, z: 0}
                                                                        }
                                                                    ]
                                                                },
                                                            ]
                                                        },
                                                    ]
                                                })
                                            }
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
