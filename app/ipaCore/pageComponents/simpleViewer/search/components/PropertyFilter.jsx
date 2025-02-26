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

const PropertyFilter = ({filter, onFilterUpdate, onFilterSave, onFilterDelete}) => {

   // Model Context
   const { modelRelatedCollections } = useContext(ModelContext)

   const [ propertyValues, setPropertyValues ] = useState()

   const [ selectedComp, setSelectedComp ] = useState(numValueComparisons.EQ)

   const [ hasChanged, setHasChanged ] = useState(true)

   useEffect(() => {
      if (filter && stringValueTypes.includes(filter.propRef.property.srcType)) {
         getStringPropValues()
      }
   }, [])

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

      })
   }

   const onFilterChange = (type, value) => {

      let updatedFilter = JSON.parse(JSON.stringify(filter))

      let query = {}

      if (type === 'string') {
         updatedFilter.stringValue = value
         query[`properties.${filter.propRef.property.key}.val`] = {$in: value}
      } else if (type === 'comp') {
         updatedFilter.comparisonValue = value
         query = makeNumberQueryPartial(updatedFilter)
      } else if (type === 'numOne') {
         if (!value) value = 0
         updatedFilter.numberOneValue = value
         query = makeNumberQueryPartial(updatedFilter)
      } else if (type === 'numTwo') {
         if (!value) value = 0
         updatedFilter.numberTwoValue = value
         query = makeNumberQueryPartial(updatedFilter)
      }

      updatedFilter.queryPartial = query
      onFilterUpdate(updatedFilter)

      setHasChanged(true)
   }

   const makeNumberQueryPartial = (updatedFilter) => {

      let query = {}
      let numberOne = updatedFilter.numberOneValue
      let numberTwo = updatedFilter.numberTwoValue


      if (['between', 'outside'].includes(updatedFilter.comparisonValue)) {
         
         let low, high

         if (numberOne < numberTwo) {
            low = numberOne
            high = numberTwo
         } else {
            low = numberTwo
            high = numberOne
         }

         if (updatedFilter.comparisonValue === numValueComparisons.BT) {

            query[`properties.${filter.propRef.property.key}.val`] = {$gt: low, $lt: high}

         } else if (updatedFilter.comparisonValue === numValueComparisons.OT) {

            query[`properties.${filter.propRef.property.key}.val`] = {$lt: low, $gt: high}

         }


      } else {
         
         if (updatedFilter.comparisonValue === numValueComparisons.EQ) {
            query[`properties.${filter.propRef.property.key}.val`] = numberOne
         } else if (updatedFilter.comparisonValue === numValueComparisons.GT) {
            query[`properties.${filter.propRef.property.key}.val`] = {$gt: numberOne}
         } else if (updatedFilter.comparisonValue === numValueComparisons.LT) {
            query[`properties.${filter.propRef.property.key}.val`] = {$lt: numberOne}
         }

      }

      return query

   }

   const saveFilter = () => {
      setHasChanged(false)
      onFilterSave(filter)
   }

   return <div className='property-filter'>
      <div className='filter-label'>{filter.label}</div>
      <hr/>
      {stringValueTypes.includes(filter.propRef.property.srcType) && <div className='string-filter-values'>
         <TreeSelect
            className='filter-tree-select'
            treeData={propertyValues}
            value={filter.stringValue}
            treeCheckable= {true}
            placeholder='Select Property Values'
            onChange={(values) => onFilterChange('string', values)}
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
            value={filter.comparisonValue || numValueComparisons.EQ}
            onChange={(value) => onFilterChange('comp', value)}
            placeholder='Select Comparison'
         />
         <div className='num-input-section'>
            <InputNumber id='numOne' className='filter-num-input' 
               value={filter.numberOneValue}
               onChange={(value) => onFilterChange('numOne', parseFloat(value))}
            />
            {['between', 'outside'].includes(filter.comparisonValue) && <div> and </div>}
            {['between', 'outside'].includes(filter.comparisonValue) && <InputNumber id='numTwo' className='filter-num-input' 
                  value={filter.numberTwoValue}
                  onChange={(value) => onFilterChange('numTwo', parseFloat(value))}
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