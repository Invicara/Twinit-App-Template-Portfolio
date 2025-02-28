import React from "react"

import { Tooltip } from "@material-ui/core"

const ExcelDownloader = () => {

   return <Tooltip title='Download Table to Excel'>
      <span className='action download-action'>
         <i className='fas fa-file-download'></i>
      </span>
   </Tooltip>

}

export default ExcelDownloader