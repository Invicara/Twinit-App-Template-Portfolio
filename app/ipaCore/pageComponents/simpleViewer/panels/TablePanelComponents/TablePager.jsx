import React from 'react'

const TablePager = ({setPage, currentPage, totalPages}) => {

   return <>
      {currentPage === 0 && <span><i className="action action-disabled fas fa-angle-double-left"></i></span>}
      {currentPage !== 0 && <span onClick={() => setPage(0)}><i className="action fas fa-angle-double-left"></i></span>}
      
      {currentPage === 0 && <span><i className="action action-disabled fas fa-angle-left"></i></span>}
      {currentPage !== 0 && <span onClick={() => setPage(currentPage-1)}><i className="action fas fa-angle-left"></i></span>}

      <span className='actions-header'>{currentPage+1} of {totalPages}</span>
      
      {currentPage === totalPages-1 && <span><i className="action action-disabled fas fa-angle-right"></i></span>}
      {currentPage !== totalPages-1 && <span onClick={() => setPage(currentPage+1)}><i className="action fas fa-angle-right"></i></span>}
      
      {currentPage === totalPages-1 && <span><i className="action action-disabled fas fa-angle-double-right"></i></span>}
      {currentPage !== totalPages-1 && <span onClick={() => setPage(totalPages-1)}><i className="action fas fa-angle-double-right"></i></span>}
   </>


}

export default TablePager