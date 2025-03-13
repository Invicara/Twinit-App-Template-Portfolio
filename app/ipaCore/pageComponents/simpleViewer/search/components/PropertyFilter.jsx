import React, { useEffect, useState, useContext } from 'react'

// https://github.com/ant-design/ant-design
import { TreeSelect, InputNumber } from 'antd'

import { IafItemSvc } from '@dtplatform/platform-api'

import { ModelContext } from '../../ModelContext'
import { numValueTypes, stringValueTypes } from '../../consts'

import './PropertyFilter.scss'

// types of numerical comparisons for numerical filters
const numValueComparisons = {
   EQ: 'equals',
   LT: 'less than',
   GT: 'greater than',
   BT: 'between',
   OT: 'outside'
}

const PropertyFilter = ({filter, onFilterUpdate, onFilterSave, onFilterDelete}) => {

   // Model Context
   const { modelRelatedCollections } = useContext(ModelContext)

   // the values to select from for a string filter
   const [ propertyValues, setPropertyValues ] = useState()

   // whether the filter has changed and requires a save
   const [ hasChanged, setHasChanged ] = useState(true)

   // on mount if a string filter fetch the unique values for that property
   // for the property from the model data
   useEffect(() => {
      if (filter && stringValueTypes.includes(filter.propRef.property.srcType)) {
         getStringPropValues()
      }
   }, [])

   // fetchs the unique values in the model data for a string property
   const getStringPropValues = () => {

      // get the NamedUserCollection for the proeprties based on the type or instance properties
      let propertyCollection = filter.propRef.property.propertyType === 'type' ? modelRelatedCollections.typeProps : modelRelatedCollections.instanceProps

      // query the elements based on property set name and property display name
      let propQuery = {}
      propQuery[`properties.${filter.propRef.property.key}.psDispName`] = filter.propRef.property.propSet
      propQuery[`properties.${filter.propRef.property.key}.dName`] = filter.propRef.property.dName

      // use a $distinctRelatedItemField query to get the unique (distinct) values of the property
      let query = {
         $distinctRelatedItemField: {
            collectionDesc: { _userItemId: propertyCollection._userItemId, _userType: propertyCollection._userType},
            field: `properties.${filter.propRef.property.key}.val`,
            query: propQuery
         }
      }

      try {
         IafItemSvc.searchRelatedItems(query).then((res) => {

            // convert the unique values into tree nodes for the filter TreeSelect
            let treeNodes = res._list[0]._versions[0]._relatedItems[`properties.${filter.propRef.property.key}.val`].map(v => {
               return {
                  title: v,
                  value: v
               }
            })

            setPropertyValues(treeNodes)

         })
      } catch (error) {
         console.error('ERROR: Fetching property values')
         console.error(error)
      }
   }

   // when a filter is changed or configured updat the filter with the queryPartial
   // that can be used to run a search with the filter
   const onFilterChange = (type, value) => {

      let updatedFilter = JSON.parse(JSON.stringify(filter))

      // the Item Service queryPartial we will construct for the filter
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

   // creates a numerc queryPartial based on the comparison type and number values
   const makeNumberQueryPartial = (updatedFilter) => {

      // the Item Service queryPartial we will construct for the filter
      let query = {}

      let numberOne = updatedFilter.numberOneValue
      let numberTwo = updatedFilter.numberTwoValue

      // if a comparison that requries two number inputs
      if (['between', 'outside'].includes(updatedFilter.comparisonValue)) {
         
         // figure out the low and high values
         // so UI doesn't hav to require which is entered first
         // ui just take two values
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
            autoClearSearchValue={false}
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