import React, {createContext, useEffect, useState } from 'react'

import { IafProj, IafItemSvc } from '@dtplatform/platform-api'
import { IafScriptEngine } from '@dtplatform/iaf-script-engine'

const ModelContext = createContext()

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

   // selectedPropRefs: Array[<Object>] the currently selected set of properties to include in model queries and the table
   // setSelectedPropRefs: <function> the function to set the selectedPropRefs
   const [ selectedPropRefs, setSelectedPropRefs ] = useState([])

   // selectedElement: <Object> the currently selected element in the model with all property info
   const [ selectedElement, setSelectedElement ] = useState()

   // sliceElements: Array[<Object>] the array of elements to isolate in th viewer
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

   // loads the related collections rlated to model NamedCompositeItem
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
            // TODOsetSelection([pkgids[0]])
         } else {
            // all other bimpk format model query
            query = { package_id: parseInt(pkgids[0]) }
            //TODO setSelection([parseInt(pkgids[0])])
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

   // given a query return the number of elements the query would return if executed
   const getElementCount = async (baseQuery) => {

      let allCountPromises = []
      let filteredCounts = []

      let _pageSize = 1000
      let totalPages = Math.floor(totalElementsCount/_pageSize)+1
      let pages = []

      // calculate pages
      for (let i = 0 ; i < totalPages; i++) {
         pages.push({_offset: i*_pageSize, _pageSize})
      }

      // for each page of elements call the Item Service
      for (let i = 0; i < pages.length; i++) {

         let baseQueryCopy = JSON.parse(JSON.stringify(baseQuery))

         baseQueryCopy.$findWithRelated.parent.options.page = pages[i]
         // by projecting just the element _id, we keep the responses small
         // instead of getting the entire element item
         baseQueryCopy.$findWithRelated.parent.options.project = { _id: 1}

         allCountPromises.push(IafItemSvc.searchRelatedItems(baseQueryCopy). then((res) => {
            filteredCounts.push(res._list[0]._versions[0]._relatedItems._filteredSize)
         }))
      }

      return Promise.all(allCountPromises).then(() => {
         // once all Item Service calls resolve, add all the _filteredSizes to get the total
         // number of elements found with the filters
         return filteredCounts.reduce((acc, curr) => acc + curr, 0)
      }).catch((error) => {
         console.error('ERROR: Getting Filtered Element Count')
         console.error(error)
         return 0
      })

   }

   // given a query, fetch the model elements and set them as the sliceElements in the viewer
   const setSliceElementsByQuery = async (baseQuery) => {
      let allCountPromises = []

      // list of all returned element items with type and instance properties
      let allElements = []

      let _pageSize = 1000
      let totalPages = Math.floor(totalElementsCount/_pageSize)+1
      let pages = []

      // calculate total pages to request
      for (let i = 0 ; i < totalPages; i++) {
         pages.push({_offset: i*_pageSize, _pageSize})
      }

      for (let i = 0; i < pages.length; i++) {

         let baseQueryCopy = JSON.parse(JSON.stringify(baseQuery))

         baseQueryCopy.$findWithRelated.parent.options.page = pages[i]

         allCountPromises.push(IafItemSvc.searchRelatedItems(baseQueryCopy). then((res) => {
            // add page of elements to the list of all returned elements
            allElements.push(...res._list[0]._versions[0]._relatedItems._list)
         }))
      }

      // when all Item Service requests resolve
      return Promise.all(allCountPromises).then(() => {

         // isolate the elements in the model viewer
         setSliceElements(simplifyElementItems(allElements))
         
      }).catch((error) => {
         console.error('ERROR: Getting Model Elements by Search')
         console.error(error)
         setSliceElements([])
      })
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
      selectedPropRefs,
      setSelectedPropRefs,
      getElementCount,
      sliceElements,
      setSliceElementsByQuery}}
   >
      { children }
   </ModelContext.Provider>
}

export { ModelContext, ModelContextProvider }