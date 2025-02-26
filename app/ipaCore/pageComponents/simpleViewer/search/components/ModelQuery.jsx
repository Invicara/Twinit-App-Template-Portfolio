import React, { useEffect, useState, useContext } from 'react'

import { TreeSelect } from 'antd';

import { IafItemSvc } from '@dtplatform/platform-api';

import { ModelContext } from '../../SimpleViewerView'

import PropertyFilter from './PropertyFilter'

import './ModelQuery.scss'

const ModelQuery = () => {

   // Model Context
   const { selectedModelComposite, modelRelatedCollections, selectedPropRefs, setSliceElements } = useContext(ModelContext)

   const [ filters, setFilters ] = useState([])

   const [ gettingFilteredCount, setGettingFilteredCount ] = useState(false)
   const [ totalElementsCount, setTotalElementsCount ] = useState()
   const [ filteredElementsCount, setFilteredElementsCount ] = useState()

   const [ gettingFilteredElements, setGettingFilteredElements ] = useState(false)

   useEffect(() => {
      getTotalElementCount()
   }, [])

   useEffect(() => {

      // remove any filters for selectedPropRefs that were removed
      let updatedFilters = []

      selectedPropRefs.forEach(spr => {

         let existingFilter = filters.find(f => spr.property.propertyType === f.propRef.property.propertyType && 
            spr.property.propSetName === f.propRef.property.propSetName && 
            spr.property.dName === f.propRef.property.dName)

         if (existingFilter) updatedFilters.push(f)

      })

      setFilters(updatedFilters)
      
   }, [selectedPropRefs])

   const getTotalElementCount = () => {
      setGettingFilteredCount(true)
      IafItemSvc.getRelatedItems(modelRelatedCollections.elements._userItemId, {
         query : {},
      }, null, { page: { _pageSize: 0, _offset: 0 } }).then((result => {
         setTotalElementsCount(result._total)
         setFilteredElementsCount(result._total)
         setGettingFilteredCount(false)
      }))

   }

   const getTreeNodes = () => {

      let availablePropRefs

      if (!filters?.length) {
         availablePropRefs = [...selectedPropRefs]
      } else {
         availablePropRefs = selectedPropRefs.filter(spr => !filters.find(f => spr.property.propertyType === f.propRef.property.propertyType && spr.property.propSetName === f.propRef.property.propSetName &&  spr.property.dName === f.propRef.property.dName))
      }

      availablePropRefs = availablePropRefs.filter(avpr => avpr.property.srcType !== "DATE" && avpr.property.srcType !== "BOOLEAN")

      return availablePropRefs.map(av => {
         return {
            title: `${av.property.propertyType} | ${av.property.propSetName} | ${av.property.dName}`,
            value: `${av.property.propertyType} | ${av.property.propSetName} | ${av.property.dName}`
         }
      }).sort((a,b) => a.title.localeCompare(b.title))

   }

   const addFilter = ( selectedValue ) => {

      let [ type, propSet, propName ] = selectedValue.split(' | ')
      let sourcePropRef = selectedPropRefs.find(spr => spr.property.propertyType === type &&  spr.property.propSetName === propSet && spr.property.dName === propName)
      setFilters([...filters, { propRef: sourcePropRef, label: selectedValue, stringValue: null, comparisonValue: null, numberOneValue: 0, numberTwoValue: 0}])

   }

   const onFilterUpdate = (updatedFilter) => {

      let updatedFilters = filters.filter(f => f.label !== updatedFilter.label)
      if (!updatedFilters) updatedFilters = []
      updatedFilters.push(updatedFilter)
      setFilters(updatedFilters)

   }

   const onFilterSave = () => {

      if (filters.length) getFilteredElementCount()
      else {
         setFilteredElementsCount(totalElementsCount)
         setSliceElements([])
      }

   }

   const onFilterDelete = (deletedFilter) => {

      let updatedFilters = filters.filter(f => f.label !== deletedFilter.label)
      setFilters(updatedFilters)

   }

   const makeRelatedFilterQuery = () => {

      let instanceQueryPartials = filters.filter(f => f.propRef.property.propertyType === 'instance' && f.queryPartial)
      let typeQueryPartials = filters.filter(f => f.propRef.property.propertyType === 'type' && f.queryPartial)

      let relatedFilter = { $and: [] }

      if (instanceQueryPartials && instanceQueryPartials.length) {
         relatedFilter.$and.push({
            query: {$and: instanceQueryPartials.map(qp => qp.queryPartial)},
				relatedDesc: { _relatedUserType: modelRelatedCollections.instanceProps._userType},
				as: 'instanceProps'
         })
      }

      if (typeQueryPartials && typeQueryPartials.length) {
         relatedFilter.$and.push({
            query: {$and: typeQueryPartials.map(qp => qp.queryPartial)},
				relatedDesc: { _relatedUserType: modelRelatedCollections.typeProps._userType},
				as: 'typeProps'
         })
      }

      return {
         $findWithRelated: {
            parent: {
               query: {},
               collectionDesc: {_userItemId: modelRelatedCollections.elements._userItemId, _userType: modelRelatedCollections.elements._userType},
               options: {}
            },
            relatedFilter
         }
      } 

   }

   const getFilteredElementCount = () => {

      if (filters.some(f => f.queryPartial)) {

         setGettingFilteredCount(true)

         let baseQuery = makeRelatedFilterQuery()

         let allCountPromises = []
         let filteredCounts = []

         let _pageSize = 1000
         let totalPages = Math.floor(totalElementsCount/_pageSize)+1
         let pages = []

         for (let i = 0 ; i < totalPages; i++) {
            pages.push({_offset: i*_pageSize, _pageSize})
         }

         for (let i = 0; i < pages.length; i++) {

            let baseQueryCopy = JSON.parse(JSON.stringify(baseQuery))

            baseQueryCopy.$findWithRelated.parent.options.page = pages[i]
            baseQueryCopy.$findWithRelated.parent.options.project = { _id: 1}

            allCountPromises.push(IafItemSvc.searchRelatedItems(baseQueryCopy). then((res) => {
               filteredCounts.push(res._list[0]._versions[0]._relatedItems._filteredSize)
            }))
         }

         Promise.all(allCountPromises).then(() => {
            setFilteredElementsCount(filteredCounts.reduce((acc, curr) => acc + curr), 0)
            setGettingFilteredCount(false)
         })
      } else {
         setFilteredElementsCount(totalElementsCount)
      }
   }

   const doSearch = () => {
      setGettingFilteredElements(true)

      let baseQuery = makeRelatedFilterQuery()
      baseQuery.$findWithRelated.relatedFilter.includeResult = true

      let allCountPromises = []
      let allElements = []

      let _pageSize = 1000
      let totalPages = Math.floor(totalElementsCount/_pageSize)+1
      let pages = []

      for (let i = 0 ; i < totalPages; i++) {
         pages.push({_offset: i*_pageSize, _pageSize})
      }

      for (let i = 0; i < pages.length; i++) {

         let baseQueryCopy = JSON.parse(JSON.stringify(baseQuery))

         baseQueryCopy.$findWithRelated.parent.options.page = pages[i]

         allCountPromises.push(IafItemSvc.searchRelatedItems(baseQueryCopy). then((res) => {
            allElements.push(...res._list[0]._versions[0]._relatedItems._list)
         }))
      }

      Promise.all(allCountPromises).then(() => {
         setSliceElements(allElements)
         setGettingFilteredElements(false)
      })

   }

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
         {filters.map((f,i) => <div>
            <PropertyFilter key={f.label} filter={f} onFilterUpdate={onFilterUpdate} onFilterSave={onFilterSave} onFilterDelete={onFilterDelete}/>
            {i < filters.length-1 && <div className='sep'><div className='filter-add-div'><span>and</span></div></div>}
         </div>)}
      </div>}
      <hr />
      <div className='sticky-control'>
         <div>Element Count: {gettingFilteredCount ? <i className='fas fa-spinner fa-spin'></i> : filteredElementsCount} of {totalElementsCount}</div>
         {!gettingFilteredElements && <div className='model-query-search-btn' onClick={doSearch}>Search</div>}
         {gettingFilteredElements && <div className='model-query-search-btn-disabled'><i className='fas fa-spinner fa-spin'></i></div>}

      </div>
   </div>

}

export default ModelQuery