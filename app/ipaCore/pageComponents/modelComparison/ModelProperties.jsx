import React, { useState, useEffect, useContext } from "react";
import { TreeSelect } from 'antd'

import { ModelContext } from "../../contexts/ModelContext";

const { SHOW_PARENT } = TreeSelect

const ModelProperties = ({ modelOne, modelTwo, selectedPropRefs, setSelectedPropRefs }) => {
    const [modelOneCollections, setModelOneCollections] = useState(null);
    const [modelTwoCollections, setModelTwoCollections] = useState(null);
    const [modelOnePropertyReferences, setModelOnePropertyReferences] = useState(null);
    const [modelTwoPropertyReferences, setModelTwoPropertyReferences] = useState(null);
    const [instPropRefs, setInstPropRefs] = useState(null);
    const [typePropRefs, setTypePropRefs] = useState(null);
    const [instPropTreeNodes, setInstPropTreeNodes] = useState(null);
    const [typePropTreeNodes, setTypePropTreeNodes] = useState(null);

    const { loadModelCollections, getPropertyReferences } = useContext(ModelContext);

    const getCollections = async () => {
        const modelOneColls = await loadModelCollections(null, modelOne);
        const modelTwoColls = await loadModelCollections(null, modelTwo);

        setModelOneCollections(modelOneColls);
        setModelTwoCollections(modelTwoColls);
    };

    const handlePropertyReferences = async (collections, setPropertyReference) => {
        const propertyReferences = await getPropertyReferences(collections);
        setPropertyReference(propertyReferences);
    };

    const getPropRefsAsTreeNodes = (propRefs, stateSetFunc) => {
        const nodes = [];

        if (propRefs?.length) {
            propRefs.forEach((pr, i) => {
                const propSetNode = nodes.find(n => n.title === pr.property.propSetName);

                if (propSetNode) {
                    propSetNode.children.push({
                        title: pr.property.dName,
                        value: `${propSetNode.value} -|- ${pr.property.dName}`,
                        propRef: pr
                    });
                } else {
                    nodes.push({
                        title: pr.property.propSetName,
                        value: pr.property.propSetName,
                        leaf: false,
                        children: [{
                            title: pr.property.dName,
                            value: `${pr.property.propSetName} -|- ${pr.property.dName}`,
                            propRef: pr
                        }]
                    });
                }
            })

            nodes.sort((a, b) => a.title.localeCompare(b.title));
            nodes.forEach(n => n.children.sort((a, b) => a.title.localeCompare(b.title)));
        }

        stateSetFunc(nodes);
    };

    const processProperties = () => {
        const typeProps = [];
        const instanceProps = [];

        const seen = new Set();
        const combinedUnique = [...modelOnePropertyReferences, ...modelTwoPropertyReferences].filter(pr => {
            const key = pr.property.dName;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        combinedUnique.forEach(pr => {
            if (pr.property.propertyType === 'type') {
                typeProps.push(pr);
            } else {
                instanceProps.push(pr);
            }
        });

        setInstPropRefs(instanceProps);
        setTypePropRefs(typeProps);

        getPropRefsAsTreeNodes(instanceProps, setInstPropTreeNodes);
        getPropRefsAsTreeNodes(typeProps, setTypePropTreeNodes);

    };

    const onTreeChange = (type, selectedPropertyNames) => {
        const allPropRefs = type === 'type' ? typePropRefs : instPropRefs;

        const tempPropRefs = selectedPropRefs.filter(slpr => slpr.property.propertyType !== type);

        if (!tempPropRefs) {
            tempPropRefs = [];
        }

        selectedPropertyNames.forEach(nv => {
            if (nv.includes(' -|- ')) {
                const [propSet, propName] = nv.split(' -|- ')

                const propRef = allPropRefs.find(pr => pr.property.propSetName === propSet && pr.property.dName === propName);

                if (propRef) {
                    tempPropRefs.push(propRef);
                }
            } else {
                const allPropRefsInSet = allPropRefs.filter(pr => pr.property.propSetName === nv);

                if (allPropRefsInSet?.length) {
                    tempPropRefs.push(...allPropRefsInSet);
                }

            }
        });

        setSelectedPropRefs(tempPropRefs)
    };

    useEffect(() => {
        getCollections();
    }, []);

    useEffect(() => {
        if (modelOneCollections) {
            handlePropertyReferences(modelOneCollections, setModelOnePropertyReferences);
        }
    }, [modelOneCollections]);

    useEffect(() => {
        if (modelTwoCollections) {
            handlePropertyReferences(modelTwoCollections, setModelTwoPropertyReferences);
        }
    }, [modelTwoCollections]);

    useEffect(() => {
        if (
            Array.isArray(modelOnePropertyReferences) &&
            modelOnePropertyReferences.length > 0 &&
            Array.isArray(modelTwoPropertyReferences) &&
            modelTwoPropertyReferences.length > 0
        ) {
            processProperties();
        }
    }, [modelOnePropertyReferences, modelTwoPropertyReferences]);

    return (
        <>
            <TreeSelect
                className='prop-tree-select'
                treeData={typePropTreeNodes}
                treeCheckable={true}
                showCheckedStrategy={SHOW_PARENT}
                onChange={(newVal) => onTreeChange('type', newVal)}
                placeholder='Select Type Properties'
                autoClearSearchValue={false}
            />
            <TreeSelect
                className='prop-tree-select'
                treeData={instPropTreeNodes}
                treeCheckable={true}
                showCheckedStrategy={SHOW_PARENT}
                onChange={(newVal) => onTreeChange('instance', newVal)}
                placeholder='Select Instance Properties'
                autoClearSearchValue={false}
            />
        </>
    );
};

export default ModelProperties;