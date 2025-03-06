import React, {createContext, useEffect, useState } from 'react'

// a context to manage the model information for the page and subcomponents
// selectedModelComposite: <NamedComposieItem> the currently selected model to show in the viewer and to query
// modelRelatedCollections: <Object> the related model collections for the selectedModelComposite Item
// modelRelatedCollections.elements: <NamedUserCollection> the NamdUserCollection containing model elements
// modelRelatedCollections.typeProps: <NamedUserCollection> the NamdUserCollection containing element type properties
// modelRelatedCollections.instanceProps: <NamedUserCollection> the NamdUserCollection containing element instance properties
// modelRelatedCollections.dataCache: <NamedUserCollection> the NamdUserCollection containing model data cached during import
// selectedElement: <Object> the currently selected element in the model with all property info
// selectElement: <function> set the current selected element in the viewer to an element
// selectedPropRefs: Array[<Object>] the currently selected set of properties to include in model queries and the table
// setSelectedPropRefs: <function> the function to set the selectedPropRefs
// sliceElements: Array[<Object>] the array of elements to isolate in th viewer
// setSliceElements: <function> the function to set the sliceElements
const ModelContext = createContext()

const ModelContextProvider = ({ children }) => {

   const [ selectedModelComposite, setSelectedModelComposite ] = useState()
   const [ modelRelatedCollections, setModelRelatedCollections ] = useState()
   const [ selectedPropRefs, setSelectedPropRefs ] = useState([])
   const [ selectedElement, setSelectedElement ] = useState()
   const [ sliceElements, setSliceElements ] = useState([])

   useEffect(() => {
      loadModelCollections()
   }, [selectedModelComposite])

   const loadModelCollections = async () => {

      setSelectedElement(null)

      if (selectedModelComposite) {
         try {
            // get collections contained in the NamedCompositeItem representing the model
            let collectionsModelCompositeItem = (await IafItemSvc.getRelatedInItem(selectedModel._userItemId, {}))._list

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
            userSelectedElement.typeProps = userSelectedElement.typeProps._list.length ? userSelectedElement.typeProps._list[0]?.properties : {}
            userSelectedElement.instanceProps = userSelectedElement.instanceProps._list.length ? userSelectedElement.instanceProps._list[0].properties : {}

            setSelectedElement(userSelectedElement)
         }
      } catch (err) {
         console.error("ERROR: Retrieving Selected Model Element")
         console.error(err)
      }
   }

   return <ModelContext.Provider value={{
      selectedModelComposite,
      setSelectedModelComposite,
      modelRelatedCollections,
      selectedElement,
      getSelectedElement,
      selectedPropRefs,
      setSelectedPropRefs,
      sliceElements,
      setSliceElements}}
   >
      { children }
   </ModelContext.Provider>
}

export { ModelContext, ModelContextProvider }