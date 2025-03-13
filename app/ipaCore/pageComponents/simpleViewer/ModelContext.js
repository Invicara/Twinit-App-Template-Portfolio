import React, {createContext, useEffect, useState } from 'react'

import { IafProj, IafItemSvc } from '@dtplatform/platform-api'
import { IafScriptEngine } from '@dtplatform/iaf-script-engine'

const ModelContext = createContext()

const API_CHUNK_SIZE = 15

const ModelContextProvider = ({ children }) => {

   // availableModelComposites: Array[<Object>] the array of imported models in the project
   const [ availableModelComposites, setAvailableModelComposites ] = useState([])

   // selectedModelComposite: <NamedComposieItem> the currently selected model to show in the viewer and to query
   const [ selectedModelComposite, setSelectedModelComposite ] = useState()

   // modelRelatedCollections: <Object> the related model collections for the selectedModelComposite Item
   // modelRelatedCollections.elements: <NamedUserCollection> the NamdUserCollection containing model elements
   // modelRelatedCollections.typeProps: <NamedUserCollection> the NamdUserCollection containing element type properties
   // modelRelatedCollections.instanceProps: <NamedUserCollection> the NamdUserCollection containing element instance properties
   // modelRelatedCollections.dataCache: <NamedUserCollection> the NamdUserCollection containing model data cached during import
   const [ modelRelatedCollections, setModelRelatedCollections ] = useState()

   // total number of elements in the model
   const [ totalElementsCount, setTotalElementsCount ] = useState()

   // all property references cached durng model import
   const [ allPropRefs, setAllPropRefs ] = useState([])
   // selectedPropRefs: Array[<Object>] the currently selected set of properties to include in model queries and the table
   // setSelectedPropRefs: <function> the function to set the selectedPropRefs
   const [ selectedPropRefs, setSelectedPropRefs ] = useState([])

   // selectedElement: <Object> the currently selected element in the model with all property info
   const [ selectedElement, setSelectedElement ] = useState()

   // sliceElements: Array[<Object>] the array of elements to isolate in the viewer
   // setSliceElements: <function> the function to set the sliceElements
   const [ sliceElements, setSliceElements ] = useState([])

   useEffect(() => {
      loadAllModels()
   }, [])

   useEffect(() => {
      loadModelCollections()
   }, [selectedModelComposite])

   useEffect(() => {
      getTotalElementCount()
      getPropertyReferences()
   }, [modelRelatedCollections])

   const loadAllModels = async () => {
      try {
         let currentProject = await IafProj.getCurrent()
         let importedModelComposites = await IafProj.getModels(currentProject)
         setAvailableModelComposites(importedModelComposites)
      } catch (err) {
         console.error("ERROR: Retrieving Imported Models")
         console.error(err)
         setAvailableModelComposites([{ _id: 0, _name:"Error Retrieving Imported Models"}])
      }
   }

   // loads the related collections related to a model NamedCompositeItem
   const loadModelCollections = async () => {

      setSelectedElement(null)

      if (selectedModelComposite) {
         try {
            // get collections contained in the NamedCompositeItem representing the model
            let collectionsModelCompositeItem = (await IafItemSvc.getRelatedInItem(selectedModelComposite._userItemId, {}))._list

            setModelRelatedCollections({
               elements: collectionsModelCompositeItem.find(c => c._userType === 'rvt_elements'),
               instanceProps: collectionsModelCompositeItem.find(c => c._userType === 'rvt_element_props'),
               typeProps: collectionsModelCompositeItem.find(c => c._userType === 'rvt_type_elements'),
               dataCache: collectionsModelCompositeItem.find(c => c._userType === 'data_cache')
            })

         } catch (error) {
            console.error('ERROR: Gettng Model NamedCompositeItem Related NamedUserItems')
            console.error(error)
         }
      } else {
         setModelRelatedCollections({
            elements: null,
            instanceProps: null,
            typeProps: null,
            dataCache: null
         })
      }
   }

   // get the total element count for the currently selected model
   const getTotalElementCount = () => {

      if (modelRelatedCollections?.elements) {
         try {
            // providing a _pageSize = 0 and _offset = 0 will just return the page info
            // with no items, so we can get the _total from the response
            IafItemSvc.getRelatedItems(modelRelatedCollections.elements._userItemId, {
               query : {},
            }, null, { page: { _pageSize: 0, _offset: 0 } }).then((result => {
               setTotalElementsCount(result._total)
            }))
         } catch (error) {
            console.error('ERROR: Getting Total Element Count')
            console.error(error)
            setTotalElementsCount(0)
         }
      }

   }

   // gets the property references from the model data cache collection
   const getPropertyReferences = async () => {

      if (modelRelatedCollections?.dataCache) {

         let _pageSize = 200
         let _offset = 0
         let total = 0
   
         let propRefs = []
   
         try {
            do {
   
               let page = await IafItemSvc.getRelatedItems(modelRelatedCollections.dataCache._userItemId, {
                  // the data_cache collection contains lots of different types of cache data
                  // we are looking for items with the dataType property of 'propertyReference'
                  query : {dataType: 'propertyReference'},
               }, null, { page: { _pageSize: _pageSize, _offset: _offset } })
   
               total = page._total
               _offset += _pageSize

               propRefs.push(...page._list)
   
            } while (propRefs.length < total)
   
            // save prop refs to state
            setAllPropRefs(propRefs)

         } catch (error) {
            console.error('ERROR: Fetchign Proprty References')
            console.error(error)
         }

      }

   }

   // simplifies the element items returnd from Twinit to eliminate
   // unnecessary levels object keys
   const simplifyElementItems = (elementArray) => {

      let newElementArray = JSON.parse(JSON.stringify(elementArray))

      // simplify element structure by bringing the type and instance
      // properties further up the object path
      newElementArray.forEach(e => {
         e.typeProps = e.typeProps._list.length ? e.typeProps._list[0]?.properties : {}
         e.instanceProps = e.instanceProps._list.length ? e.instanceProps._list[0].properties : {}
      })

      return newElementArray

   }

   // get the element data from the model for the currently selected element
   const getSelectedElement = async (pkgids) => {
      setSelectedElement(null)

      try {

         // Different models return different element properties when clicked in the viewer
         // IFC models return a string that matches an elements source_id
         // Revit models return an integer that maches an elements package_id
         // We try to guess what we get from the viewer and make the appropriate query
         let pkgidIsString = typeof pkgids[0] === 'string' || pkgids[0] instanceof String
         let pkgidIsNotANumber = isNaN(pkgids[0])

         let query
         if (pkgidIsString && pkgidIsNotANumber) {
            // IFC Specific Query
            query = { source_id: pkgids[0] }
         } else {
            // all other bimpk format model query
            query = { package_id: parseInt(pkgids[0]) }
         }

         // query the element collection as the parent
         // and follow relationships to the child instance and type properties
         let selectedModelElements = await IafScriptEngine.findWithRelated({
            parent: { 
               query: query,
               collectionDesc: {_userItemId: modelRelatedCollections.elements._userItemId, _userType: modelRelatedCollections.elements._userType},
            },
            related: [
               {
                  relatedDesc: { _relatedUserType: modelRelatedCollections.instanceProps._userType},
                  as: 'instanceProps'
               },
               {
                  relatedDesc: { _relatedUserType: modelRelatedCollections.typeProps._userType},
                  as: 'typeProps'
               }
            ]
         })

         let userSelectedElement = selectedModelElements._list[0]
         if (userSelectedElement) {
            
            setSelectedElement(simplifyElementItems([userSelectedElement])[0])
         }
      } catch (err) {
         console.error("ERROR: Retrieving Selected Model Element")
         console.error(err)
      }
   }

   // set the currently selected element directly, such as from the table panel
   const selectElement = (element) => {

      setSelectedElement([])
      setSelectedElement(element)

   }

   // creates a base $findWithRelated Item Service query that can be used to:
   // 1. get the total element count that would be returned if a search is done
   // 2. get the elements as a result of a search
   // it relies on queryPartials added to the filters when a user configures a filter
   // see the PropertyFilter and ModelQuery components
   const makeRelatedFilterQuery = (filters) => {

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

   // breaks an array of pages down into smaller arrays of chunkSize
   const chunkPages = (pages, chunkSize) => {

      let chunks = []

      for (let i = 0; i < pages.length; i += chunkSize) {
         chunks.push(pages.slice(i, i + chunkSize))
      }

      return chunks

   }

   // creates a findWithRelated query between a property collection and the element collection
   // you can have it optionally return the element ids by passing true for withElemIds
   const getElementQuery = (propertyColl, queryPartials, withElemIds) => {

      let query =  {
         parent: {
            query: {$and: queryPartials.map(qp => qp.queryPartial)},
            collectionDesc: {_userItemId: propertyColl._userItemId, _userType: propertyColl._userType},
            options: {
               page: { getAllItems: true },
               project: { _id: 1 }
            }
         },
         related: [
            {
               relatedDesc: {
                  _isInverse: true,
                  _relatedUserType: modelRelatedCollections.elements._userType
               },
               options: {
                  page: { _pageSize: 0 }
               },
               as: "elements"
            }
         ]
      }

      if (withElemIds) {
         query.related[0].options.project = { _id: 1 },
         query.related[0].options.page = { getAllItems: true }
      }

      return query
   }

   // gets the count of elements that would be returned by a model query
   // does it the most efficient way depending on if there are instance, type, or both queries
   const getElementCount = async (filters) => {

      // get all the instance and type query partials from filters which have them
      let instanceQueryPartials = filters.filter(f => f.propRef.property.propertyType === 'instance' && f.queryPartial)
      let typeQueryPartials = filters.filter(f => f.propRef.property.propertyType === 'type' && f.queryPartial)

      let instanceQuery = instanceQueryPartials.length > 0
      let typeQuery = typeQueryPartials.length > 0

      if (instanceQuery && !typeQuery) {
         // just do instance query

         let result = await IafScriptEngine.findWithRelated(getElementQuery(modelRelatedCollections.instanceProps, instanceQueryPartials))

         return result._list.reduce((acc, value) => acc += value.elements._total, 0)

      } else if (!instanceQuery && typeQuery) {
         //just do type query

         let result = await IafScriptEngine.findWithRelated(getElementQuery(modelRelatedCollections.typeProps, typeQueryPartials))

         return result._list.reduce((acc, value) => acc += value.elements._total, 0)

      } else if (instanceQuery && typeQuery) {

         //do both and reconcile _ids
         let instResult = await IafScriptEngine.findWithRelated(getElementQuery(modelRelatedCollections.instanceProps, instanceQueryPartials, true))
         let typeResult = await IafScriptEngine.findWithRelated(getElementQuery(modelRelatedCollections.typeProps, typeQueryPartials, true))

         let instElemIds = []
         instResult._list.forEach(i => i.elements._list.forEach(e => instElemIds.push(e._id)))
         let typeElemIds = []
         typeResult._list.forEach(i => i.elements._list.forEach(e => typeElemIds.push(e._id)))

         let inBoth = instElemIds.filter(i => typeElemIds.includes(i))

         return inBoth.length

      } else {
         return totalElementsCount
      }

   }

   // given a query, fetch the model elements and set them as the sliceElements in the viewer
   // this method uses a relatedFilter query
   // this can be slower for larger models as it requires we page through the entire
   // list of model elements to get results (which can include empty pages since none
   // of the elements in that page may match the filter)
   // TO DO: investigate using a graph query to more quickly return elements
   const setSliceElementsByQuery = async (filters) => {
      
      let baseQuery = makeRelatedFilterQuery(filters)
      // includs the properties in the result
      baseQuery.$findWithRelated.relatedFilter.includeResult = true

      // list of all returned element items with type and instance properties
      let allElements = []

      let _pageSize = 1000
      let totalPages = Math.floor(totalElementsCount/_pageSize)+1
      let pages = []

      // calculate total pages to request
      for (let i = 0 ; i < totalPages; i++) {
         pages.push({_offset: i*_pageSize, _pageSize})
      }

      // chunk the pages into small groups so as not to
      // send too many API calls to Twinit all at once
      let pageChunks = chunkPages(pages, API_CHUNK_SIZE)

      for (let i = 0; i < pageChunks.length; i++) {

         let pageChunk = pageChunks[i]
         let pageChunkPromises = []

         // for each page of elements call the Item Service
         for (let i = 0; i < pageChunk.length; i++) {

            let baseQueryCopy = JSON.parse(JSON.stringify(baseQuery))

            baseQueryCopy.$findWithRelated.parent.options.page = pageChunk[i]

            pageChunkPromises.push(IafItemSvc.searchRelatedItems(baseQueryCopy).then((res) => {
               // add page of elements to the list of all returned elements
               allElements.push(...res._list[0]._versions[0]._relatedItems._list)
            }))
         }

         await Promise.all(pageChunkPromises).catch((error) => {
            console.error('ERROR: Getting Model Elements by Search')
            console.error(error)
            allElements = []
         })

      }

      // isolate the elements in the model viewer
      setSliceElements(simplifyElementItems(allElements))

   } 

   return <ModelContext.Provider value={{
      availableModelComposites,
      selectedModelComposite,
      setSelectedModelComposite,
      modelRelatedCollections,
      totalElementsCount,
      selectedElement,
      selectElement,
      getSelectedElement,
      allPropRefs,
      selectedPropRefs,
      setSelectedPropRefs,
      getElementCount,
      sliceElements,
      setSliceElements,
      setSliceElementsByQuery}}
   >
      { children }
   </ModelContext.Provider>
}

export { ModelContext, ModelContextProvider }