import React, {useContext } from "react"

import { ModelContext } from "../../ModelContext"

// a table cell component that provides a class when the currently selected element
// matches the table row to allow row highlighting
const SelectableCell = ({ _id }) => {

   const { selectedElement, selectElement, sliceElements } = useContext(ModelContext)

   const onSelectFromTable = () => {
      let element = sliceElements.find(se => se._id === _id)
      selectElement(element)
   }

   return <>
      {_id === selectedElement?._id && <span className='highlight-cell'><i className="fas fa-angle-right"></i></span>}
      {_id !== selectedElement?._id && <span className='not-highlight-cell' onClick={onSelectFromTable}><i className="far fa-circle"></i></span>}
   </>

}

export default SelectableCell