import React from 'react';
import './ActionButton.scss';
import { Tooltip } from "@mui/material";


export default function ActionButton(props) {
    return <span>
        <Tooltip title={props.title}>
            {props.children}
        </Tooltip>
    </span>
}