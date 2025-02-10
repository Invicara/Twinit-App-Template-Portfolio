import React from "react"
import { makeStyles } from "@material-ui/core"

const useStyles = makeStyles({
    button: {
        color: 'inherit',
        background: 'transparent',
        border: 0
    }
})

const TextButton = ({ children, ...props }) => {
    const classes = useStyles()
    return <button {...props} className={`${classes.button} ${props.className}`}>{children}</button>
}

export default TextButton
