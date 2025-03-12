import React, { useEffect, useState, useContext} from 'react'

// https://github.com/ant-design/ant-design
import { TreeSelect } from 'antd'

import { ModelContext } from "../../ModelContext"

import './PropertySelector.scss'

const { SHOW_PARENT } = TreeSelect

const PropertySelector = () => {

   // Model Context
   const { selectedModelComposite, allPropRefs, selectedPropRefs, setSelectedPropRefs } = useContext(ModelContext)

   // the list of instance property references (unique) in the model - produced during import
   const [ instPropRefs, setInstPropRefs ] = useState()
   // tree nodes for the TreeSelect for instance property refs
   const [ instPropTreeNodes, setInstPropTreeNodes ] = useState([])

   // the list of type property references (unique) in the model - produced during import
   const [ typePropRefs, setTypePropRefs ] = useState()
   // tree nodes for the TreeSelect for instance property refs
   const [ typePropTreeNodes, setTypePropTreeNodes ] = useState([])

   useEffect(() => {

         if (selectedModelComposite) {
            setInstPropRefs(null)
            setInstPropTreeNodes(null)
            setTypePropRefs(null)
            setTypePropTreeNodes(null)
            loadAllProperties()
         }
   
   }, [allPropRefs])

   // loads all the property references from the model's data_cache collection
   // seperates into type and instance lists
   // then creates tree nodes for each
   const loadAllProperties = async () => {

      let typeProps = []
      let instanceProps = []

      allPropRefs.forEach(pr => {
         if (pr.property.propertyType === 'type') {
            typeProps.push(pr)
         } else {
            instanceProps.push(pr)
         }
      })
      
      // save prop refs to state
      setInstPropRefs(instanceProps)
      setTypePropRefs(typeProps)

      // create tree nodes for TreeSelect
      getPropRefsAsTreeNodes(instanceProps, setInstPropTreeNodes)
      getPropRefsAsTreeNodes(typeProps, setTypePropTreeNodes)

   }

   // transforms an array of prop refs into TreeSelect tree nodes
   // property sets are the first level of the tree
   // individual prop refs are children (second level) of the prop sets in the tree
   // propRefs: the prop refs to transform to tree nodes
   // stateSetFunc: the function to use to store the tree node to the page state
   const getPropRefsAsTreeNodes = (propRefs, stateSetFunc) => {

      let nodes = []

      if (propRefs?.length) {

         propRefs.forEach((pr,i) => {

            let propSetNode = nodes.find(n => n.title === pr.property.propSetName)

            if (propSetNode) {
               // adding a prop ref to an existing propSet group in the tree
               propSetNode.children.push({
                  title: pr.property.dName,
                  value: `${propSetNode.value} -|- ${pr.property.dName}`,
                  propRef: pr
               })
            } else {
               // adding a new prop set and child prop ref in the tree
               nodes.push({
                  title: pr.property.propSetName,
                  value: pr.property.propSetName,
                  leaf: false,
                  children: [{
                     title: pr.property.dName,
                     // prop ref values contain a reference to their propSet for future processing
                     // when selected in the tree, we need to knwo what propSet the selected
                     // tree node belongs to, so we add it to the start of the value
                     // "propSetName -|- propRefName"
                     value: `${pr.property.propSetName} -|- ${pr.property.dName}`,
                     propRef: pr
                  }]
               })
            }

         })

         // sort propSets alphabetically
         nodes.sort((a,b) => a.title.localeCompare(b.title))
         // within each propset sort the prop refs alphabetically
         nodes.forEach(n => n.children.sort((a,b) => a.title.localeCompare(b.title)))
         
      }

      stateSetFunc(nodes)

   }

   // manages a single list of instance and type prop refs as the user interacts with the tree
   // reads from and updates the Model Context with the current list
   // type: instance or type
   // selectedPropertyNames: a string array of selected property values
   const onTreeChange = (type, selectedPropertyNames) => {

      // get the complete list of prop refs based on prop ref type: instance or type
      let allPropRefs = type === 'type' ? typePropRefs : instPropRefs

      // get the current list of propRefs on the Model Context for the type of prop refs that are not changing
      let tempPropRefs = selectedPropRefs.filter(slpr => slpr.property.propertyType !== type)
      if (!tempPropRefs) tempPropRefs = []

      // for each currently selected tree node value
      selectedPropertyNames.forEach(nv => {

         // if the value represent a prop ref
         // split it to get the prop set and prop name
         // then find the original prop ref in the complete list
         if (nv.includes(' -|- ')) {

            let [ propSet, propName ] = nv.split(' -|- ')

            let propRef = allPropRefs.find(pr => pr.property.propSetName === propSet && pr.property.dName === propName)
            if (propRef) tempPropRefs.push(propRef)


         } else {
            
            // else the value represents all prop refs in a prop set being selected
            // find all prop refs with the prop set name from the complete list
            let allPropRefsInSet = allPropRefs.filter(pr => pr.property.propSetName === nv)
            if (allPropRefsInSet?.length) tempPropRefs.push(...allPropRefsInSet)

         }

      })

      // set Model Context with the updated list
      setSelectedPropRefs(tempPropRefs)

   }

   return <>
      <TreeSelect
         className='prop-tree-select'
         treeData={typePropTreeNodes}
         treeCheckable= {true}
         showCheckedStrategy ={SHOW_PARENT}
         onChange={(newVal) => onTreeChange('type', newVal)}
         placeholder='Select Type Properties'
         autoClearSearchValue={false}
      />
      <TreeSelect
         className='prop-tree-select'
         treeData={instPropTreeNodes}
         treeCheckable= {true}
         showCheckedStrategy ={SHOW_PARENT}
         onChange={(newVal) => onTreeChange('instance', newVal)}
         placeholder='Select Instance Properties'
         autoClearSearchValue={false}
      />
   </>


}

export default PropertySelector