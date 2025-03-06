import React, { useEffect, useState, useContext } from 'react'

// https://github.com/ant-design/ant-design
import { TreeSelect } from 'antd';

import { IafItemSvc } from '@dtplatform/platform-api';

import { ModelContext } from '../../ModelContext'

import PropertyFilter from './PropertyFilter'

import './ModelQuery.scss'

// a component that manges creating search filters and querying the model data
const ModelQuery = () => {

   // Model Context
   const { selectedModelComposite,
      modelRelatedCollections,
      totalElementsCount,
      selectedPropRefs,
      getElementCount,
      setSliceElementsByQuery 
   } = useContext(ModelContext)

   // the list of search filters to use when querying the model data
   // propRef: <Object> the property reference for which the filter was created
   // label: <String> the label to use when displying the filter
   // stringValue: Array[<String>] an array of string values to query for fo String properties 
   // comparisonValue: <String> the type fo comparison to due to numberic filters, see propertyFilter.jsx
   // numberOneValue: <Number> the first or only numeric value in a numeric filter
   // numberTwoValue: <Number> the second numeric value in a numeric filter (if required by comparison)
   const [ filters, setFilters ] = useState([])

   // the number of elements to be returned if the user searchs with th currently configured filters
   const [ filteredElementsCount, setFilteredElementsCount ] = useState()
   // if the component is currently fetching the number of elements that would be returned
   // by the currently configured filters
   const [ gettingFilteredCount, setGettingFilteredCount ] = useState(false)
   // if the component is currently fetching the elements (not just the count)
   // using the currently configured filters
   const [ gettingFilteredElements, setGettingFilteredElements ] = useState(false)

   // whenever the selected model changes set the filtered count to the total count
   useEffect(() => {
      if (selectedModelComposite) setFilteredElementsCount(totalElementsCount)
   }, [selectedModelComposite, totalElementsCount])

   // if the selected property references change
   // remove any filters for selectedPropRefs that were removed
   useEffect(() => {

      let updatedFilters = []

      // for each selected property reference get its filter if one exists
      // set the list of filters to the resulting list
      // this removes filters for property references which were removed
      selectedPropRefs.forEach(spr => {

         let existingFilter = filters.find(f => spr.property.propertyType === f.propRef.property.propertyType && 
            spr.property.propSetName === f.propRef.property.propSetName && 
            spr.property.dName === f.propRef.property.dName)

         if (existingFilter) updatedFilters.push(existingFilter)

      })

      setFilters(updatedFilters)
      getFilteredElementCount(updatedFilters)      
      
   }, [selectedPropRefs])


   // get the treenodes needed to display the TreeSelect of selected property references
   const getTreeNodes = () => {

      // the list of selected proprty references without filters yet created
      let availablePropRefs

      if (!filters?.length) {
         availablePropRefs = [...selectedPropRefs]
      } else {
         // do nto include selected property references that already have filters
         availablePropRefs = selectedPropRefs.filter(spr => !filters.find(f => spr.property.propertyType === f.propRef.property.propertyType && spr.property.propSetName === f.propRef.property.propSetName &&  spr.property.dName === f.propRef.property.dName))
      }

      // remove Date and Boolan property references from the list as they are not yet supported
      // TODO: add Date and Boolean support to PropertyFilter
      availablePropRefs = availablePropRefs.filter(avpr => avpr.property.srcType !== "DATE" && avpr.property.srcType !== "BOOLEAN")

      return availablePropRefs.map(av => {
         return {
            title: `${av.property.propertyType} | ${av.property.propSetName} | ${av.property.dName}`,
            value: `${av.property.propertyType} | ${av.property.propSetName} | ${av.property.dName}`
         }
      }).sort((a,b) => a.title.localeCompare(b.title))

   }

   // add a new un-configured filter to the list of filters
   const addFilter = ( selectedValue ) => {

      let [ type, propSet, propName ] = selectedValue.split(' | ')
      let sourcePropRef = selectedPropRefs.find(spr => spr.property.propertyType === type &&  spr.property.propSetName === propSet && spr.property.dName === propName)
      setFilters([...filters, { propRef: sourcePropRef, label: selectedValue, stringValue: null, comparisonValue: null, numberOneValue: 0, numberTwoValue: 0}])

   }

   // update a filter in the filter list by replacing it with the updated copy
   const onFilterUpdate = (updatedFilter) => {

      let updatedFilters = filters.filter(f => f.label !== updatedFilter.label)
      if (!updatedFilters) updatedFilters = []
      updatedFilters.push(updatedFilter)
      setFilters(updatedFilters)

   }

   // save a filter configuration and trigger a query to get the count
   // of filtered elements based on all configured filters
   const onFilterSave = () => {

      if (filters.length) getFilteredElementCount(filters)
      else {
         setFilteredElementsCount(totalElementsCount)
         setSliceElements([])
      }

   }

   // remove deleted filters from the list of filters
   const onFilterDelete = (deletedFilter) => {

      let updatedFilters = filters.filter(f => f.label !== deletedFilter.label)
      setFilters(updatedFilters)
      getFilteredElementCount(updatedFilters)

      // if there are no filters left clear any isolated elements in the viewer
      // this returns to all elements being visible and selectable in the viewer
      if (!updatedFilters?.length) {
         setSliceElements([])
      }

   }

   // creates a base $findWithRelated Item Service query that can be used to:
   // 1. get the total element count that would be returned if a search is done
   // 2. get the elements as a result of a search
   // it relies on queryPartials added to the filters when a user configures a filter
   // see the PropertyFilter component
   const makeRelatedFilterQuery = () => {

      // get all the instance and type query partials from filters which have them
      let instanceQueryPartials = filters.filter(f => f.propRef.property.propertyType === 'instance' && f.queryPartial)
      let typeQueryPartials = filters.filter(f => f.propRef.property.propertyType === 'type' && f.queryPartial)

      let relatedFilter = { $and: [] }

      // create the relatedFilter for instance property filters
      if (instanceQueryPartials && instanceQueryPartials.length) {
         relatedFilter.$and.push({
            // query is an AND for all instance property filters
            query: {$and: instanceQueryPartials.map(qp => qp.queryPartial)},
				relatedDesc: { _relatedUserType: modelRelatedCollections.instanceProps._userType},
				as: 'instanceProps'
         })
      } else {
         // if no instance query partials include an empty query so that if elements are being
         // returned by the query we still receive all the instance properties
         relatedFilter.$and.push({
            query: {},
				relatedDesc: { _relatedUserType: modelRelatedCollections.instanceProps._userType},
				as: 'instanceProps'
         })
      }

      // create the relatedFilter for type property filters
      if (typeQueryPartials && typeQueryPartials.length) {
         relatedFilter.$and.push({
            // query is an AND for all type property filters
            query: {$and: typeQueryPartials.map(qp => qp.queryPartial)},
				relatedDesc: { _relatedUserType: modelRelatedCollections.typeProps._userType},
				as: 'typeProps'
         })
      } else {
         // if no type query partials include an empty query so that if elements are being
         // returned by the query we still receive all the type properties
         relatedFilter.$and.push({
            query: {},
				relatedDesc: { _relatedUserType: modelRelatedCollections.typeProps._userType},
				as: 'typeProps'
         })
      }

      return {
         $findWithRelated: {
            parent: {
               query: {}, // no element query as the relatdFilter provides the filters for elements
               collectionDesc: {_userItemId: modelRelatedCollections.elements._userItemId, _userType: modelRelatedCollections.elements._userType},
               options: {}
            },
            relatedFilter
         }
      } 

   }

   // get the count of elements that would be retrieved if the user searched with the current filters
   // A NOTE ABOUT USING relatedFilter in Item Service queries
   // In the $findWithRelated query, the parent query is empty, this means all elements in the model
   // will be examined as to whether they match the relatedFilter portion fo the query
   // It also means that $findWithRelated query returns results based on the parent queries page.
   // Each page may or may not have elements that match the relatedFilter. Each page will also include
   // a _filteredSize for the page. _filteredSize is the count of items that match the relatedFilter
   // for that page of result.
   // So if there are 1000 model elements and the _pagSize is 200, to get all the filtered element counts
   // we need to make 5 Item Service calls (on for each page of parent elements).
   const getFilteredElementCount = async (currentFilters) => {

      // if at least one filter has been configured
      if (currentFilters.some(f => f.queryPartial)) {

         setGettingFilteredCount(true)

         // get the base $findWithRelated Item Service query
         let baseQuery = makeRelatedFilterQuery()
         getElementCount(baseQuery).then((elemCount) => {
            setFilteredElementsCount(elemCount)
         }).catch(() => {
            setFilteredElementsCount(0)
         }).finally(() => {
            setGettingFilteredCount(false)
         })
         
         
      } else {
         // if there are no configured filters then the filtered count if the count of total elements
         setFilteredElementsCount(totalElementsCount)
      }
   }

   // get all the elements based on current filters and updat the Model Context with the elements
   const doSearch = () => {
      setGettingFilteredElements(true)

      let baseQuery = makeRelatedFilterQuery()
      // by setting includeResult to true we ge back to type and instance property items
      // relatd to each element item
      baseQuery.$findWithRelated.relatedFilter.includeResult = true

      setSliceElementsByQuery(baseQuery).catch(() => {
         
      }).finally(() => {
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
         {filters.map((f,i) => <div key={f.label}>
            <PropertyFilter filter={f} onFilterUpdate={onFilterUpdate} onFilterSave={onFilterSave} onFilterDelete={onFilterDelete}/>
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