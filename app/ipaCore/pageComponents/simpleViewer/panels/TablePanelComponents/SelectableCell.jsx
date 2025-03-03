import React, {useContext } from "react"

import { ModelContext } from "../../SimpleViewerView"

// a table cell component that provides a class when the currently selected element
// matches the table row to allow row highlighting
const SelectableCell = ({ _id, children }) => {

   const { selectedElement } = useContext(ModelContext)

   return <>
      {_id === selectedElement?._id && <span className='highlight-cell'>{children}</span>}
      {_id !== selectedElement?._id && <span>{children}</span>}
   </>

}

export default SelectableCell