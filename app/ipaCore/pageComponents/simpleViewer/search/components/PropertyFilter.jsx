import React, { useEffect, useState, useContext } from 'react'

import { TreeSelect, InputNumber } from 'antd'

import { IafItemSvc } from '@dtplatform/platform-api'

import { ModelContext } from '../../SimpleViewerView'

import './PropertyFilter.scss'


const numValueTypes = [ 'DOUBLE', 'FLOAT', 'INTEGER', 'LONG' ]
const numValueComparisons = {
   EQ: 'equals',
   LT: 'less than',
   GT: 'greater than',
   BT: 'between',
   OT: 'outside'
}

const stringValueTypes = [ 'STRING' ]

const PropertyFilter = ({filter, onFilterSave, onFilterDelete}) => {

   // Model Context
   const { modelRelatedCollections } = useContext(ModelContext)

   const [ localValue, setLocalValue ] = useState([])
   const [ propertyValues, setPropertyValues ] = useState()

   const [ selectedComp, setSelectedComp ] = useState(numValueComparisons.EQ)
   const [ numberOne, setNumberOne ] = useState(0)
   const [ numberTwo, setNumberTwo ] = useState(0)

   const [ queryPartial, setQueryPartial ] = useState()

   const [ hasChanged, setHasChanged ] = useState(false)

   useEffect(() => {
      if (filter && stringValueTypes.includes(filter.propRef.property.srcType)) {
         getStringPropValues()
      }
   }, [])

   useEffect(() => {
      onNumberChange()
   }, [numberOne, numberTwo])

   const getStringPropValues = () => {

      let propertyCollection = filter.propRef.property.propertyType === 'type' ? modelRelatedCollections.typeProps : modelRelatedCollections.instanceProps

      let propQuery = {}
      propQuery[`properties.${filter.propRef.property.key}.psDispName`] = filter.propRef.property.propSet
      propQuery[`properties.${filter.propRef.property.key}.dName`] = filter.propRef.property.dName

      let query = {
         $distinctRelatedItemField: {
            collectionDesc: { _userItemId: propertyCollection._userItemId, _userType: propertyCollection._userType},
            field: `properties.${filter.propRef.property.key}.val`,
            query: propQuery
         }
      }

      IafItemSvc.searchRelatedItems(query).then((res) => {

         let treeNodes = res._list[0]._versions[0]._relatedItems[`properties.${filter.propRef.property.key}.val`].map(v => {
            return {
               title: v,
               value: v
            }
         })

         setPropertyValues(treeNodes)

         if (filter.values) {
            setLocalValue(filter.values)
         }
      })
   }

   const onStringChange = (values) => {

      let query = {}
      query[`properties.${filter.propRef.property.key}.val`] = {$in: values}

      setLocalValue(values)
      setQueryPartial(query)
      setHasChanged(true)
   }

   const onCompareChange = (value) => {
      setSelectedComp(value)
      setHasChanged(true)
   }

   const onNumberChange = () => {

      let query = {}
      if (['between', 'outside'].includes(selectedComp)) {
         
         let low, high

         if (numberOne < numberTwo) {
            low = numberOne
            high = numberTwo
         } else {
            low = numberTwo
            high = numberOne
         }

         if (selectedComp === numValueComparisons.BT) {

            query[`properties.${filter.propRef.property.key}.val`] = {$gt: low, $lt: high}

         } else if (selectedComp === numValueComparisons.OT) {

            query[`properties.${filter.propRef.property.key}.val`] = {$lt: low, $gt: high}

         }


      } else {
         
         if (selectedComp === numValueComparisons.EQ) {
            query[`properties.${filter.propRef.property.key}.val`] = numberOne
         } else if (selectedComp === numValueComparisons.GT) {
            query[`properties.${filter.propRef.property.key}.val`] = {$gt: numberOne}
         } else if (selectedComp === numValueComparisons.LT) {
            query[`properties.${filter.propRef.property.key}.val`] = {$lt: numberOne}
         }

      }

      setQueryPartial(query)
      setHasChanged(true)

   }

   const saveFilter = () => {
      setHasChanged(false)
      onFilterSave({...filter, queryPartial, values: localValue})
   }

   return <div className='property-filter'>
      <div className='filter-label'>{filter.label}</div>
      <hr/>
      {stringValueTypes.includes(filter.propRef.property.srcType) && <div className='string-filter-values'>
         <TreeSelect
            className='filter-tree-select'
            treeData={propertyValues}
            value={localValue}
            treeCheckable= {true}
            placeholder='Select Property Values'
            onChange={onStringChange}
         />
      </div>}
      {numValueTypes.includes(filter.propRef.property.srcType) && <div className='number-filter-values'>
         <TreeSelect
            className='filter-tree-select'
            treeData={Object.values(numValueComparisons).map(v => {
               return {
                  title: v,
                  value: v
               }
            })}
            value={selectedComp}
            onChange={onCompareChange}
            placeholder='Select Comparison'
         />
         <div className='num-input-section'>
            <InputNumber id='numOne' className='filter-num-input' 
               value={numberOne}
               onChange={(value) => setNumberOne(parseFloat(value))}
            />
            {['between', 'outside'].includes(selectedComp) && <div> and </div>}
            {['between', 'outside'].includes(selectedComp) && <InputNumber id='numTwo' className='filter-num-input' 
                  value={numberTwo}
                  onChange={(value) => setNumberTwo(parseFloat(value))}
            />}
         </div>
      </div>}
      <div className='filter-btns'>
         <div className='filter-btn delete' onClick={() => onFilterDelete(filter)}>Delete</div>
         {hasChanged && <div className='filter-btn save-active' onClick={saveFilter}>Save</div>}
         {!hasChanged && <div className='filter-btn save-disabled'>Save</div>}
      </div>
   </div>
}

export default PropertyFilter