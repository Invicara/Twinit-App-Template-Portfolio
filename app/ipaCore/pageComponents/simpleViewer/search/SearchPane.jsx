import React, { useEffect, useState, useContext } from "react";

import { TreeSelect } from 'antd';

import { IafItemSvc } from "@dtplatform/platform-api";
import { IafScriptEngine } from "@dtplatform/iaf-script-engine";

import { ModelContext } from "../SimpleViewerView";

import './SearchPane.scss'

const SEARCH_CHECK_STATE = 'checking'
const SEARCH_ENABLED_STATE = 'enabled'
const SEARCH_DISABLED_STATE = 'disabled'

const { SHOW_PARENT } = TreeSelect;

const SearchPane = ({onPropertyChange}) => {

   const { selectedModelComposite, modelRelatedCollections } = useContext(ModelContext)

   const [ searchEnabled, setSearchEnabled ] = useState(SEARCH_CHECK_STATE)
   const [ instPropRefs, setInstPropRefs ] = useState()
   const [ instPropTreeNodes, setInstPropTreeNodes ] = useState([])
   const [ typePropRefs, setTypePropRefs ] = useState()
   const [ typePropTreeNodes, setTypePropTreeNodes ] = useState([])

   useEffect(() => {

      setSearchEnabled(SEARCH_CHECK_STATE)
      if (selectedModelComposite) checkSearchable()

   }, [selectedModelComposite])

   useEffect(() => {

      if (searchEnabled === SEARCH_ENABLED_STATE) loadAllProperties()

   }, [searchEnabled])

   const checkSearchable = async () => {

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

   const loadAllProperties = async () => {
   
      let _pageSize = 200
      let _offset = 0
      let total = 0

      let typeProps = []
      let instanceProps = []

      do {

         let page = await IafItemSvc.getRelatedItems(modelRelatedCollections.dataCache._userItemId, {
            query : {dataType: 'propertyReference'},
         }, null, { page: { _pageSize: _pageSize, _offset: _offset } })

         total = page._total
         _offset += _pageSize

         page._list.forEach((pr) => {

            if (pr.property.propertyType === 'type') {
               typeProps.push(pr)
            } else {
               instanceProps.push(pr)
            }

         })

      } while ((typeProps.length + instanceProps.length) < total)

      setInstPropRefs(instanceProps)
      setTypePropRefs(typeProps)

      getPropRefsAsTreeNodes(instanceProps, setInstPropTreeNodes)
      getPropRefsAsTreeNodes(typeProps, setTypePropTreeNodes)

   }

   const getPropRefsAsTreeNodes = (propRefs, stateSetFunc) => {

      let nodes = []

      if (propRefs?.length) {

         propRefs.forEach((pr,i) => {

            let propSetNode = nodes.find(n => n.title === pr.property.propSetName)

            if (propSetNode) {
               propSetNode.children.push({
                  title: pr.property.dName,
                  value: `${propSetNode.value} -|- ${pr.property.dName}`,
                  propRef: pr
               })
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
               })
            }

         })

         nodes.sort((a,b) => a.title.localeCompare(b.title))
         nodes.forEach(n => n.children.sort((a,b) => a.title.localeCompare(b.title)))
         
      }

      stateSetFunc(nodes)

   }

   const onTreeChange = (type, selectedPropertyNames) => {

      if (onPropertyChange) {

         let allPropRefs = type === 'type' ? typePropRefs : instPropRefs
         let selectedPropRefs = []

         selectedPropertyNames.forEach(nv => {

            if (nv.includes(' -|- ')) {

               let { propSet, propName } = nv.split(' -|- ')
               let propRef = allPropRefs.find(pr => pr.property.propSetName === propSet && pr.property.dName === propName)
               if (propRef) selectedPropRefs.push(propRef)

            } else {
               
               let allPropRefsInSet = allPropRefs.filter(pr => pr.property.propSetName === nv)
               if (allPropRefsInSet?.length) selectedPropRefs.push(...allPropRefsInSet)

            }

         })
         console.log(selectedPropRefs)

         onPropertyChange(selectedPropRefs)
      }

   }
  

   return <div className='search-pane'>
      {searchEnabled === SEARCH_CHECK_STATE && <div>Checking for search enabled model cache content</div>}
      {searchEnabled === SEARCH_DISABLED_STATE && <div>Search Disabled!</div>}
      {searchEnabled === SEARCH_ENABLED_STATE && <div>
         <div className='section-header'><span>Select Table Properties</span></div>
         <TreeSelect
            className='tree-select'
            treeData={typePropTreeNodes}
            treeCheckable= {true}
            showCheckedStrategy ={SHOW_PARENT}
            onChange={(newVal) => onTreeChange('type', newVal)}
            placeholder='Select Type Properties'
         />
         <TreeSelect
            className='tree-select'
            treeData={instPropTreeNodes}
            treeCheckable= {true}
            showCheckedStrategy ={SHOW_PARENT}
            onChange={(newVal) => onTreeChange('instance', newVal)}
            placeholder='Select Instance Properties'
         />
      </div>}
   </div>

}

export default SearchPane