import React, {useContext } from "react"

import { ModelContext } from "../../SimpleViewerView"

const SelectableCell = ({ _id, children }) => {

   const { selectedElement } = useContext(ModelContext)

   return <>
      {_id === selectedElement?._id && <span className='highlight-cell'>{children}</span>}
      {_id !== selectedElement?._id && <span>{children}</span>}
   </>

}

export default SelectableCell