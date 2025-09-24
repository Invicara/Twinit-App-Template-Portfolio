import React, { useRef, useState, useContext, useEffect } from 'react';
import { Panel, PanelGroup } from "react-resizable-panels";

import { IafViewerDBM } from '@dtplatform/iaf-viewer';
import { IafItemSvc } from "@dtplatform/platform-api"
import { StackableDrawer } from '@invicara/ipa-core/modules/IpaControls';

import ModelSelect from '../../components/ModelSelect/ModelSelect';
import { ModelContext } from '../../contexts/ModelContext';

const Animations2DView = (props) => {
    return <Animations2DPage {...props} />
};

const Animations2DPage = () => {
    const [workflow, setWorkflow] = useState(null);
    const [animations, setAnimations] = useState(null);
    const [isViewerReady, setIsViewerReady] = useState(false);

    const viewerRef = useRef();

    const {
        selectedModelComposite,
        selectedModelCompositeVersion,
    } = useContext(ModelContext);

    const fetchAnimations = async () => {
        const animationsCollectionUserType = "2d_animations";

        const animations_coll = await IafItemSvc.getNamedUserItems({
            query: {
                _userType: animationsCollectionUserType,
            }
        });

        if (animations_coll && animations_coll._list.length > 0) {
            return await IafItemSvc.getRelatedItems(animations_coll._list[0]._userItemId, {
                query: {}
            });
        }
    };

    useEffect(() => {
        const run = async () => {
            const animations = await fetchAnimations();
            setAnimations(animations._list);
        };

        run();
    }, []);

    const injectElementIds = (uuid, ids) => {
        const animation = animations.find((item) => item.uuid === uuid);

        const { _id, _metadata, ...rest } = animation;

        rest.elementIds = ids;

        return rest;
    };

    useEffect(() => {
        if (Array.isArray(animations) && animations.length > 0 && isViewerReady) {
            setWorkflow({
                active: 5,
                list: [
                    {
                        uuid: 5,
                        timeInSeconds: 4.5,
                        loop: true,
                        script: [
                            injectElementIds("lab_warning", [203, 204, 201]),
                            injectElementIds("sprite_warning_gif", [161]),
                            injectElementIds("patient_bed_move", [2362]),
                            injectElementIds("patient_bed_color", [2362]),
                            injectElementIds("text", [2324]),
                            {
                                uuid: 'circle',
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
                                uuid: "opacity",
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
                        ]
                    },
                ]
            })
        }
    }, [animations, isViewerReady]);

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
                                                setIsViewerReady(true);
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
