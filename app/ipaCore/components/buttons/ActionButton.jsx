import React from "react"

import './ActionButtons.scss'

export const ActionButton = ({onClick, label, className, disabled =  false}) => {
    return <button disabled={disabled} onClick={onClick} className={className}>{label}</button>
}