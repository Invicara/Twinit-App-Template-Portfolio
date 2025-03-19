import React, {createContext, useEffect, useState, useMemo } from 'react'

import { IafProj, IafItemSvc } from '@dtplatform/platform-api'
import { IafScriptEngine } from '@dtplatform/iaf-script-engine'

const ModelContext = createContext()

const API_CHUNK_SIZE = 15
const ELEMENT_CHUNK_SIZE = 500

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
   // unnecessary levels of object keys
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
         let selectedModelElements = await IafScriptEngine.findWithRelated(makeElementQuery(query))

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

   // breaks an array of ids or id arrays down into smaller arrays of chunkSize
   const chunkIds = (ids, chunkSize) => {

      let chunks = []

      for (let i = 0; i < ids.length; i += chunkSize) {
         chunks.push(ids.slice(i, i + chunkSize))
      }

      return chunks

   }

   // creates a findWithRelated query that returns elements with all propereties
   // uses either a provided query or an empty query which will return all elemenets
   const makeElementQuery = (elementQuery) => {

      let query = {
         parent: { 
            query: elementQuery || {},
            collectionDesc: {_userItemId: modelRelatedCollections.elements._userItemId, _userType: modelRelatedCollections.elements._userType},
            options: {
               page: { getAllItems: true }
            }
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
      }

      return query
   }

   // creates a findWithRelated query between a property collection and the element collection
   // you can have it optionally return the element ids by passing true for withElemIds
   const makeElementByPropQuery = (propertyColl, queryPartials, withElemIds) => {

      let query =  {
         parent: {
            query: {$and: queryPartials.map(qp => qp.queryPartial)},
            collectionDesc: {_userItemId: propertyColl._userItemId, _userType: propertyColl._userType},
            options: {
               page: { getAllItems: true, _pageSize: 2000 },
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

      try {
         if (instanceQuery && !typeQuery) {
            // since there is only an instance query we can simply query the elements related to the instance property
            // instancePropery ---_isInverse:true---> element

            let result = await IafScriptEngine.findWithRelated(makeElementByPropQuery(modelRelatedCollections.instanceProps, instanceQueryPartials))

            return result._list.reduce((acc, value) => acc += value.elements._total, 0)

         } else if (!instanceQuery && typeQuery) {
            // since there is only a type query we can simply query the elements related to the type property
            // typePropery ---_isInverse:true---> element

            let result = await IafScriptEngine.findWithRelated(makeElementByPropQuery(modelRelatedCollections.typeProps, typeQueryPartials))

            return result._list.reduce((acc, value) => acc += value.elements._total, 0)

         } else if (instanceQuery && typeQuery) {

            // if both instance and type queries are present we do each search individually
            // and then generate the list of element _ids returned in both queries
            // instancePropery ---_isInverse:true---> element (_id)
            // typePropery ---_isInverse:true---> element (_id)

            // this is much faster for queries than using an alternative like the relatedFilter which would 
            // cause us to have to page through every page of elements looking for the ones that match the relatedFilter
            // -- in a large file that could be 100,000 or more elements
            
            // with this implmentation we generate a smaller list of element _ids that match the
            // instance query and a smaller list of element _ids that match the type query and
            // then find the element _ids in both, then fetch the elements by _id
            // in almost all cases, excluding those that will return nearly all model elements,
            // this is much faster than paging through all model elements using relatedFilter

            // and when retrieving only a few elements it is hundreds of times faster

            let bothPromises = []

            let instElemIds = []
            bothPromises.push(IafScriptEngine.findWithRelated(makeElementByPropQuery(modelRelatedCollections.instanceProps, instanceQueryPartials, true)).then((instResult) => {
               instResult._list.forEach(i => i.elements._list.forEach(e => instElemIds.push(e._id)))
            }))

            let typeElemIds = []
            bothPromises.push(IafScriptEngine.findWithRelated(makeElementByPropQuery(modelRelatedCollections.typeProps, typeQueryPartials, true)).then((typeResult) => {
               typeResult._list.forEach(i => i.elements._list.forEach(e => typeElemIds.push(e._id)))
            }))

            await Promise.all(bothPromises)
          
            let inBoth = instElemIds.filter(i => typeElemIds.includes(i))

            return inBoth.length

         } else {
            return totalElementsCount
         }
      } catch (error) {
         console.error('ERROR: Getting Model Element Count')
         console.error(error)
      }

   }

   // given a query, fetch the model elements and set them as the sliceElements in the viewer
   const setSliceElementsByQuery = async (filters) => {

      // get all the instance and type query partials from filters which have them
      let instanceQueryPartials = filters.filter(f => f.propRef.property.propertyType === 'instance' && f.queryPartial)
      let typeQueryPartials = filters.filter(f => f.propRef.property.propertyType === 'type' && f.queryPartial)

      let instanceQuery = instanceQueryPartials.length > 0
      let typeQuery = typeQueryPartials.length > 0

      // first we get the list of element _ids the query will return

      let idChunks
 
      try {
         if (instanceQuery && !typeQuery) {
            // since there is only an instance query we can simply query the elements related to the instance property
            // instancePropery ---_isInverse:true---> element
   
            let result = await IafScriptEngine.findWithRelated(makeElementByPropQuery(modelRelatedCollections.instanceProps, instanceQueryPartials, true))

            let instElemIds = []
            result._list.forEach(i => i.elements._list.forEach(e => instElemIds.push(e._id)))

            idChunks = chunkIds(instElemIds, ELEMENT_CHUNK_SIZE)

         } else if (!instanceQuery && typeQuery) {
            // since there is only a type query we can simply query the elements related to the type property
            // typePropery ---_isInverse:true---> element
   
            let result = await IafScriptEngine.findWithRelated(makeElementByPropQuery(modelRelatedCollections.typeProps, typeQueryPartials, true))

            let typeElemIds = []
            result._list.forEach(i => i.elements._list.forEach(e => typeElemIds.push(e._id)))

            idChunks = chunkIds(typeElemIds, ELEMENT_CHUNK_SIZE)
   
         } else if (instanceQuery && typeQuery) {

            // if both instance and type queries are present we do each search individually
            // and then generate the list of element _ids returned in both queries
            // instancePropery ---_isInverse:true---> element (_id)
            // typePropery ---_isInverse:true---> element (_id)

            // this is much faster for queries than using an alternative like the relatedFilter which would 
            // cause us to have to page through every page of elements looking for the ones that match the relatedFilter
            // -- in a large file that could be 100,000 or more elements
            
            // with this implmentation we generate a smaller list of element _ids that match the
            // instance query and a smaller list of element _ids that match the type query and
            // then find the element _ids in both, then fetch the elements by _id
            // in almost all cases, excluding those that will return nearly all model elements,
            // this is much faster than paging through all model elements using relatedFilter

            // and when retrieving only a few elements it is hundreds of times faster
   
            let bothPromises = []

            let instElemIds = []
            bothPromises.push(IafScriptEngine.findWithRelated(makeElementByPropQuery(modelRelatedCollections.instanceProps, instanceQueryPartials, true)).then((instResult) => {
               instResult._list.forEach(i => i.elements._list.forEach(e => instElemIds.push(e._id)))
            }))

            let typeElemIds = []
            bothPromises.push(IafScriptEngine.findWithRelated(makeElementByPropQuery(modelRelatedCollections.typeProps, typeQueryPartials, true)).then((typeResult) => {
               typeResult._list.forEach(i => i.elements._list.forEach(e => typeElemIds.push(e._id)))
            }))

            await Promise.all(bothPromises)
          
            let inBoth = instElemIds.filter(i => typeElemIds.includes(i))

            idChunks = chunkIds(inBoth, ELEMENT_CHUNK_SIZE)
   
         }
      } catch (error) {
         console.error('ERROR: Getting Model Element ids by Search')
         console.error(error)
         return
      }

      // then we query the item service for all the elements with the _ids and get their properties
      let allElements = []

      try {
         // throttle the number of API calls to the API_CHUNK_SIZE in case may need to be made
         let chunkChunks = chunkIds(idChunks, API_CHUNK_SIZE)
         for (let i = 0; i < chunkChunks.length; i++) {

            let idChunk = chunkChunks[i]
            let idChunkPromises = []

            // for each d chunk of elements call the Item Service
            for (let i = 0; i < idChunk.length; i++) {

               let query = {_id: {$in: idChunk[i]}}

               idChunkPromises.push(IafScriptEngine.findWithRelated(makeElementQuery(query)).then((res) => {
                  // add page of elements to the list of all returned elements
                  allElements.push(...res._list)
                  console.log(res)
               }))
            }

            await Promise.all(idChunkPromises).catch((error) => {
               console.error('ERROR: Getting Model Elements by Search')
               console.error(error)
               allElements = []
            })
         }

      } catch (error) {
         console.error('ERROR: Getting Model Elements by id Search')
         console.error(error)
         allElements = []
      }

      // isolate the elements in the model viewer
      setSliceElements(simplifyElementItems(allElements))

   }

   const memoizedContextValue = useMemo(() => {
      return {
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
         setSliceElementsByQuery}
   }, [ 
         availableModelComposites,
         selectedModelComposite,
         modelRelatedCollections,
         totalElementsCount,
         selectedElement,
         allPropRefs,
         selectedPropRefs,
         sliceElements
      ]
   )

   return <ModelContext.Provider value={memoizedContextValue}>
      { children }
   </ModelContext.Provider>
}

export { ModelContext, ModelContextProvider }