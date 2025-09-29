import React, { useState, useEffect, useRef } from 'react';

import './FilterDropdown.scss'

const EcStatus = ['All', 'Only Approved', 'Only Registered', 'Only Closed', 'Includes Approved', 'Includes Registered', 'Includes Only'];

export const FilterDropdown = ({selectedStatus, setSelectedStatus}) => {
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

// TODO Should there be an option for 'All'?. Currently if we select a status, we can not undo a selection and display all?
  const handleStatusChange = (statusName) => {
    console.log('Adam handleStatusChange called', statusName)
    if(statusName === "All") {
        setSelectedStatus('')
    } else {
        setSelectedStatus(statusName)
    }
    setIsOpen(false);
  };


  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="filter-dropdown">
        <div className="filter-label-wrapper" onClick={toggleDropdown}>
            <div className="filter-label">
                <span>Filter By:</span> <span>{selectedStatus ? `(${selectedStatus})` : null}</span> <i className="fas fa-chevron-down"></i>
            </div>
            {isOpen && (
                <div className="EC-dropdown-menu">
                    {EcStatus.map((status) => (
                        <label key={status} className="dropdown-item" onClick={() => handleStatusChange(status)}>
                            <p className="category-text">{status}</p>
                        </label>
                    ))}
                </div>
            )}
        </div>
    </div>

  );
};  