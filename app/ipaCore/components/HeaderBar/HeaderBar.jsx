import React from "react"
import { makeStyles } from "@material-ui/core"
import { palette } from "../../../styles/defaultTheme"

import AccountMenu from "./AccountMenu"
import SeparatorIcon from "../../../assets/icons/pipe.svg"
import Logo from "./Logo"

const useStyles = makeStyles((theme) => ({
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '80px',
        paddingLeft: theme.spacing(6),
        paddingRight: theme.spacing(3),
        backgroundColor: 'var(--head-bkg-color)',
        borderBottom: `1px solid ${palette.neutral['200']}`
    },
    logoWrapper: {
        display: 'flex',
        alignItems: 'center'
    },
    appTitle: {
        fontSize: 15,
        fontWeight: 700,
        textWrap: 'nowrap',
        color: 'var(--head-appname-color)'
    },
    separator: {
        margin: `0 ${theme.spacing(2)}px`,
        filter: 'brightness(0) invert(99%) sepia(0%) saturate(5%) hue-rotate(135deg) brightness(87%) contrast(96%)'
    }
}))

const HeaderBar = (props) => {
    const classes = useStyles()
    const appTitle = props.userConfig?.settings?.appTitle

    return (
        <div className={`HeaderBar__container ${classes.container}`}>
            <div className={classes.logoWrapper}>
                <Logo userGroupId={props?.selectedItems?.selectedUserGroupId} appImageSettings={props?.userConfig?.settings?.appImage} />
                {appTitle &&
                    <>
                        <img className={classes.separator} src={SeparatorIcon} />
                        <span className={classes.appTitle}>{appTitle}</span>
                    </>
                }
                {props.selectedItems.selectedProject &&
                    <>
                        <img className={classes.separator} src={SeparatorIcon} />
                        <span className={classes.appTitle}>{props.selectedItems.selectedProject._name}</span>
                    </>
                }
            </div>
            <AccountMenu { ...props } />
        </div>
    )
}

export default HeaderBar
