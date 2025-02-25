import React, { useEffect, useState, useContext } from "react";

import { TreeSelect } from 'antd';

import { IafItemSvc } from "@dtplatform/platform-api";

import { ModelContext } from "../SimpleViewerView";

import './SearchPane.scss'

const SEARCH_CHECK_STATE = 'checking'
const SEARCH_ENABLED_STATE = 'enabled'
const SEARCH_DISABLED_STATE = 'disabled'

const { SHOW_PARENT } = TreeSelect;

const SearchPane = ({}) => {

   const { selectedModelComposite, modelRelatedCollections, setSelectedPropRefs } = useContext(ModelContext)
   const [ totalElementsCount, setTotalElementsCount ] = useState()
   const [ filteredElementsCount, setFilteredElementsCount ] = useState()

   const [ searchEnabled, setSearchEnabled ] = useState(SEARCH_CHECK_STATE)
   const [ instPropRefs, setInstPropRefs ] = useState()
   const [ instPropTreeNodes, setInstPropTreeNodes ] = useState([])
   const [ typePropRefs, setTypePropRefs ] = useState()
   const [ typePropTreeNodes, setTypePropTreeNodes ] = useState([])

   const [ selectedLocalPropRefs, setSelectedLocalPropRefs ] = useState([])

   useEffect(() => {

      setSearchEnabled(SEARCH_CHECK_STATE)
      if (selectedModelComposite) {
         checkSearchable()
         setInstPropRefs(null)
         setInstPropTreeNodes(null)
         setTypePropRefs(null)
         setTypePropTreeNodes(null)
      }

   }, [selectedModelComposite])

   useEffect(() => {

      if (searchEnabled === SEARCH_ENABLED_STATE) {
         loadAllProperties()
         getTotalElementCount()
      }

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

   const getTotalElementCount = () => {

      IafItemSvc.getRelatedItems(modelRelatedCollections.elements._userItemId, {
         query : {},
      }, null, { page: { _pageSize: 0, _offset: 0 } }).then((result => {
         setTotalElementsCount(result._total)
         setFilteredElementsCount(result._total)
      }))

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

      let allPropRefs = type === 'type' ? typePropRefs : instPropRefs
      let tempPropRefs = selectedLocalPropRefs.filter(slpr => slpr.property.propertyType !== type)
      if (!tempPropRefs) tempPropRefs = []
      console.log('1', tempPropRefs)

      selectedPropertyNames.forEach(nv => {

         if (nv.includes(' -|- ')) {

            let [ propSet, propName ] = nv.split(' -|- ')
            console.log('3', propSet, propName)
            let propRef = allPropRefs.find(pr => pr.property.propSetName === propSet && pr.property.dName === propName)
            if (propRef) tempPropRefs.push(propRef)
            console.log('3', propRef)

         } else {
            
            let allPropRefsInSet = allPropRefs.filter(pr => pr.property.propSetName === nv)
            if (allPropRefsInSet?.length) tempPropRefs.push(...allPropRefsInSet)
            console.log('4', allPropRefsInSet)

         }

      })
      console.log('2', tempPropRefs)

      setSelectedLocalPropRefs(tempPropRefs)
      setSelectedPropRefs(tempPropRefs)


   }

   
  

   return <div className='search-pane'>
      {searchEnabled === SEARCH_CHECK_STATE && <div>Checking for search enabled model cache content</div>}
      {searchEnabled === SEARCH_DISABLED_STATE && <div>Search Disabled!</div>}
      {searchEnabled === SEARCH_ENABLED_STATE && <div>
         <div className='section-header'><span>Select Properties</span></div>
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
         <div className='section-header'><span>Filter Elements</span></div>
         <hr />
         Element Count: {filteredElementsCount} of {totalElementsCount} 
      </div>}
   </div>

}

export default SearchPane