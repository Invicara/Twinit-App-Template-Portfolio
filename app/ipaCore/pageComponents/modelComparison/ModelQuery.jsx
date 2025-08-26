import React, { useEffect, useState, useContext } from 'react';
import { TreeSelect } from 'antd';

import { ModelContext } from '../../contexts/ModelContext';

import PropertyFilter from '../../components/search/components/PropertyFilter';

const ModelQuery = ({ modelOne, modelTwo, selectedPropRefs, setModelOneSliceIDs, setModelTwoSliceIDs }) => {
    const {
        getElementCount,
        setSliceElementsByQuery,
        getTotalElementCount,
        loadModelCollections,
    } = useContext(ModelContext);

    const [filters, setFilters] = useState([]);
    const [totalElementsCount, setTotalElementsCount] = useState(0);
    const [filteredElementsCount, setFilteredElementsCount] = useState(0);
    const [gettingFilteredCount, setGettingFilteredCount] = useState(false);
    const [gettingFilteredElements, setGettingFilteredElements] = useState(false);
    const [modelOneCollections, setModelOneCollections] = useState(null);
    const [modelTwoCollections, setModelTwoCollections] = useState(null);

    const getCollections = async () => {
        const modelOneColls = await loadModelCollections(null, modelOne);
        const modelTwoColls = await loadModelCollections(null, modelTwo);

        setModelOneCollections(modelOneColls);
        setModelTwoCollections(modelTwoColls);
    };

    const getTotalElementsCount = async () => {
        const modelOneElementCount = await getTotalElementCount(modelOneCollections);
        const modelTwoElementCount = await getTotalElementCount(modelTwoCollections);

        setTotalElementsCount(modelOneElementCount + modelTwoElementCount)
    };

    const getFilteredElementCount = async (currentFilters) => {
        if (currentFilters.some(f => f.queryPartial)) {
            setGettingFilteredCount(true);

            const modelOneTotal = await getElementCount(currentFilters, modelOneCollections, totalElementsCount);
            const modelTwoTotal = await getElementCount(currentFilters, modelTwoCollections, totalElementsCount);

            setGettingFilteredCount(false);
            setFilteredElementsCount(modelOneTotal + modelTwoTotal);
        } else {
            setFilteredElementsCount(totalElementsCount);
        }
    };

    useEffect(() => {
        getCollections();
    }, []);

    useEffect(() => {
        if (modelOneCollections && modelTwoCollections) {
            getTotalElementsCount();
        }
    }, [modelOneCollections, modelTwoCollections]);

    useEffect(() => {
        const updatedFilters = [];

        selectedPropRefs.forEach(spr => {
            const existingFilter = filters.find(f => spr.property.propertyType === f.propRef.property.propertyType &&
                spr.property.propSetName === f.propRef.property.propSetName &&
                spr.property.dName === f.propRef.property.dName)

            if (existingFilter) {
                updatedFilters.push(existingFilter);
            }
        });

        setFilters(updatedFilters);
        getFilteredElementCount(updatedFilters);
    }, [selectedPropRefs, totalElementsCount]);

    const getTreeNodes = () => {
        let availablePropRefs;

        if (!filters?.length) {
            availablePropRefs = [...selectedPropRefs]
        } else {
            availablePropRefs = selectedPropRefs.filter(spr => !filters.find(f => spr.property.propertyType === f.propRef.property.propertyType && spr.property.propSetName === f.propRef.property.propSetName && spr.property.dName === f.propRef.property.dName));
        }

        availablePropRefs = availablePropRefs.filter(avpr => avpr.property.srcType !== "DATE" && avpr.property.srcType !== "BOOLEAN");

        return availablePropRefs.map(av => {
            return {
                title: `${av.property.propertyType} | ${av.property.propSetName} | ${av.property.dName}`,
                value: `${av.property.propertyType} | ${av.property.propSetName} | ${av.property.dName}`
            }
        }).sort((a, b) => a.title.localeCompare(b.title));
    };

    const addFilter = (selectedValue) => {
        const [type, propSet, propName] = selectedValue.split(' | ');
        const sourcePropRef = selectedPropRefs.find(spr => spr.property.propertyType === type && spr.property.propSetName === propSet && spr.property.dName === propName);

        setFilters([...filters, { propRef: sourcePropRef, label: selectedValue, stringValue: null, comparisonValue: null, numberOneValue: 0, numberTwoValue: 0 }]);
    };

    const onFilterUpdate = (updatedFilter) => {
        const updatedFilters = filters.filter(f => f.label !== updatedFilter.label);

        if (!updatedFilters) {
            updatedFilters = [];
        }

        updatedFilters.push(updatedFilter);

        setFilters(updatedFilters);
    };

    const onFilterSave = () => {
        if (filters.length) {
            getFilteredElementCount(filters);
        } else {
            setFilteredElementsCount(totalElementsCount);
            setModelOneSliceIDs([]);
            setModelTwoSliceIDs([]);
        }
    };

    const onFilterDelete = (deletedFilter) => {
        const updatedFilters = filters.filter(f => f.label !== deletedFilter.label);

        setFilters(updatedFilters);
        getFilteredElementCount(updatedFilters);

        if (!updatedFilters?.length || updatedFilters.length === 0) {
            setModelOneSliceIDs([]);
            setModelTwoSliceIDs([]);
        }
    };

    const doSearch = async () => {
        setGettingFilteredElements(true)

        const elementsModelOne = await setSliceElementsByQuery(filters, modelOneCollections);
        const elementsModelTwo = await setSliceElementsByQuery(filters, modelTwoCollections);

        setModelOneSliceIDs(elementsModelOne);
        setModelTwoSliceIDs(elementsModelTwo);

        setGettingFilteredElements(false);
    };

    return <div className='model-query'>
        {!selectedPropRefs?.length && <div className='model-query-no-props-msg'>
            Select Properties to Create Filters
        </div>}
        {!!selectedPropRefs?.length && <div className='model-query-filters'>
            <TreeSelect
                className='add-prop-filter-tree-select'
                value={null}
                treeData={getTreeNodes()}
                placeholder='Select Property for Filter'
                onChange={addFilter}
            />
            {filters.map((f, i) => <div key={f.label}>
                <PropertyFilter
                    filter={f}
                    onFilterUpdate={onFilterUpdate}
                    onFilterSave={onFilterSave}
                    onFilterDelete={onFilterDelete}
                    modelOneCollections={modelOneCollections}
                    modelTwoCollections={modelTwoCollections}
                />
                {i < filters.length - 1 && <div className='sep'><div className='filter-add-div'><span>and</span></div></div>}
            </div>)}
        </div>}
        <hr />
        <div className='sticky-control'>
            <div>Element Count: {gettingFilteredCount ? <i className='fas fa-spinner fa-spin'></i> : filteredElementsCount} of {totalElementsCount}</div>
            {!gettingFilteredElements && <div className='model-query-search-btn' onClick={async () => await doSearch()}>Search</div>}
            {gettingFilteredElements && <div className='model-query-search-btn-disabled'><i className='fas fa-spinner fa-spin'></i></div>}
        </div>
    </div>

}

export default ModelQuery;
