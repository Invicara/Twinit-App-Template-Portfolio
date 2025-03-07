import React, { useEffect, useState, useContext } from "react";

import { IafItemSvc } from "@dtplatform/platform-api";

import { ModelContext } from "../ModelContext";

import PropertySelector from "./components/PropertySelector";
import ModelQuery from "./components/ModelQuery";

import './SearchPane.scss'

// search pane states
// since the search pane depends on certain model import data tha may not exist
// the seach pane may or may not enable based on the selected model
const SEARCH_CHECK_STATE = 'checking'
const SEARCH_ENABLED_STATE = 'enabled'
const SEARCH_DISABLED_STATE = 'disabled'

const SearchPane = ({}) => {

   // Model Context
   const { selectedModelComposite, modelRelatedCollections } = useContext(ModelContext)
   
   // whether the search pane is enabled or not
   const [ searchEnabled, setSearchEnabled ] = useState(SEARCH_CHECK_STATE)

   useEffect(() => {

      setSearchEnabled(SEARCH_CHECK_STATE)
      if (selectedModelComposite) {
         checkSearchable()
      }

   }, [selectedModelComposite, modelRelatedCollections])

   // check if model data_cache items exist with the Property References information
   // this data is required to enable the search pane and produced during model import
   const checkSearchable = async () => {

      if (modelRelatedCollections.dataCache) {
         try {

            let result = await IafItemSvc.getRelatedItems(modelRelatedCollections.dataCache._userItemId, {
                  query : {dataType: 'propertyReference'},
               }, null, { page: { _pageSize: 0, _offset: 0 } }
            )

            if (result._total === 0) {
               setSearchEnabled(SEARCH_DISABLED_STATE)
            } else {
               setSearchEnabled(SEARCH_ENABLED_STATE)
            }
         } catch (err) {
            console.error(err)
            setSearchEnabled(SEARCH_DISABLED_STATE)
         }
      }

   }

   return <div className='search-pane'>
      {searchEnabled === SEARCH_CHECK_STATE && <div className='search-check-msg'><i className="fas fa-spinner fa-spin"></i> Checking if this model is search enabled.</div>}
      {searchEnabled === SEARCH_DISABLED_STATE && <div className='search-disabled-msg'>This model is not search enabled. Please re-import your model to generate property data to enable model search.</div>}
      {searchEnabled === SEARCH_ENABLED_STATE && <div>
         <div className='section-header'><span>Select Properties</span></div>
         <PropertySelector />
         <div className='section-header'><span>Filter Elements</span></div>
         <ModelQuery />
      </div>}
   </div>

}

export default SearchPane