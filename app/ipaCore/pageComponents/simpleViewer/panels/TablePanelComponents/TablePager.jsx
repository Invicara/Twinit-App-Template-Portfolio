import React from 'react'

import { Tooltip } from "@material-ui/core"

// able pager component
const TablePager = ({ setPage,   // function to set the curret page
      currentPage,               // the current page displaying
      totalPages                 // total number of pages
   }) => {

   return <>
      {currentPage === 0 && <span><i className="action action-disabled fas fa-angle-double-left"></i></span>}
      {currentPage !== 0 && <Tooltip title='First Page'>
         <span onClick={() => setPage(0)}>
            <i className="action fas fa-angle-double-left"></i>
         </span>
      </Tooltip>}
      
      {currentPage === 0 && <span><i className="action action-disabled fas fa-angle-left"></i></span>}
      {currentPage !== 0 && <Tooltip title='Previous Page'>
         <span onClick={() => setPage(currentPage-1)}>
            <i className="action fas fa-angle-left"></i>
         </span>
      </Tooltip>}

      <span className='actions-header'>{currentPage+1} of {totalPages}</span>
      
      {currentPage === totalPages-1 && <span><i className="action action-disabled fas fa-angle-right"></i></span>}
      {currentPage !== totalPages-1 && <Tooltip title='Next Page'>
         <span onClick={() => setPage(currentPage+1)}>
            <i className="action fas fa-angle-right"></i>
         </span>
         </Tooltip>}
      
      {currentPage === totalPages-1 && <span><i className="action action-disabled fas fa-angle-double-right"></i></span>}
      {currentPage !== totalPages-1 && <Tooltip title='Last Page'>
         <span onClick={() => setPage(totalPages-1)}>
            <i className="action fas fa-angle-double-right"></i>
         </span>
      </Tooltip>}
   </>


}

export default TablePager