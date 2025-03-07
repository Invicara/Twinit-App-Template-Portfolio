import React, { useMemo, useState, useEffect } from "react"
import { makeStyles } from "@material-ui/core"
import { palette } from "../../../styles/defaultTheme"

import { IafProj } from '@dtplatform/platform-api'

import TextButton from "../atoms/TextButton"
import ArrowDownIcon from "../../../assets/icons/arrow-down.svg"
import ExitIcon from "../../../assets/icons/right-from-bracket.svg"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Avatar from "@mui/material/Avatar"

const THEME_HANDLER_NAME = 'theme'
const USERGROUP_HANDLER_NAME = 'userGroups'
const DOWNLOAD_PLUGNS_URL = 'https://apps.invicara.com/ipaplugins/'

const useStyles = makeStyles((theme) => ({
    container: {
        display: 'flex',
    },
    anchorButton: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        color: 'var(--head-appname-color)'
    },
    avatar: {
        '&.MuiAvatar-root': {
            width: theme.spacing(3),
            height: theme.spacing(3),
            fontSize: 10,
            color: 'var(--app-accent-color)',
            backgroundColor: palette.brand['300']
        }
    },
    arrowDown: props => ({
        transform: `rotate(${props.open ? '180' : 0}deg)`,
        transition: `transform 0.25s ease`,
        filter: 'brightness(0) invert(36%) sepia(0%) saturate(32%) hue-rotate(156deg) brightness(97%) contrast(88%)'
    }),
    menu: {
        '& .MuiList-root': {
            minWidth: theme.spacing(32),
            padding: '0 !important',
            backgroundColor: 'var(--head-menu-bkg-color)'
        },
    },
    menuHeader: {
        display: 'flex',
        flexDirection: 'column',
        padding: theme.spacing(2),
        textAlign: 'center',
        borderBottom: `1px solid ${palette.neutral['200']}`
    },
    menuHeaderName: {
        marginTop: 0,
        marginBottom: theme.spacing(1),
        fontSize: 15,
        color: palette.neutral['900']
    },
    menuHeaderEmail: {
        fontSize: 13,
        color: palette.neutral['700']
    },
    menuItem: {
        display: 'flex',
        justifyContent: 'space-between !important',
        height: theme.spacing(6),
        padding: `0 ${theme.spacing(2)}px !important`,
        fontSize: '13px !important',
        '&.MuiMenuItem-root:hover': {
            backgroundColor: 'var(--head-menu-hover-color)'
        }
    },
    menuItemArrow: {
        transform: 'rotate(-90deg)',
        filter: 'brightness(0) invert(36%) sepia(0%) saturate(32%) hue-rotate(156deg) brightness(97%) contrast(88%)'
    },
    logoutOption: {
        display: 'flex',
        gap: theme.spacing(1),
        color: palette.error,
        '& img': {
            filter: 'brightness(0) invert(18%) sepia(98%) saturate(6137%) hue-rotate(356deg) brightness(95%) contrast(73%)'
        }
    },
    appVersion: {
        display: 'flex',
        alignItems: 'center',
        height: theme.spacing(4),
        padding: `0 ${theme.spacing(2)}px`,
        fontSize: 13,
        color: palette.neutral['600'],
        borderTop: `1px solid ${palette.neutral['200']}`
    },
    projVersion: {
        display: 'flex',
        alignItems: 'center',
        height: theme.spacing(4),
        padding: `0 ${theme.spacing(2)}px`,
        fontSize: 13,
        color: palette.neutral['600']
    }
}))

const AccountMenu = ({ user, ...props }) => {
    const { goToUserAccount, switchProj, userLogout } = props
    const [anchorEl, setAnchorEl] = useState(null)
    const classes = useStyles({ open: Boolean(anchorEl) })

    const [ projectVersion, setProjectVersion ] = useState('')

    const handlers = props?.userConfig?.handlers

    useEffect(() => {
        getProjectVersion()
    }, [props.userConfig])

    const getProjectVersion = async () => {
        let project = await IafProj.getCurrent()

        let projVersion
        projVersion = project._userAttributes?.quickModelView?.currentVersion
        if (!projVersion) projVersion = project._userAttributes?.projectMaker?.currentVersion // old version location

        projVersion = props?.userConfig?.homepage.handler === 'projectMaker' ? 'QMV Manager' : projVersion
        setProjectVersion(projVersion)
    }

    const menuItems = useMemo(() => {
        const items = [
            { label: 'My Profile', onClick: goToUserAccount  },
            { label: 'User Groups', onClick: () => window.location = `#${handlers[USERGROUP_HANDLER_NAME]?.path}`},
            { label: 'Switch Project', onClick: switchProj  },
            { label: 'Downloads', onClick: () => window.open(DOWNLOAD_PLUGNS_URL, '_blank')},
            /* FUTURE: { label: 'Theme & Brand', onClick: () => window.location = `#${handlers[THEME_HANDLER_NAME]?.path}`  },*/
            { label: <span className={classes.logoutOption}><img src={ExitIcon} /> Log out</span>, onClick: userLogout },
        ].filter((item) => {
            if (
                (item.label == 'User Groups' && !props.userConfig?.handlers?.userGroups)
                || (item.label == 'Theme & Brand' && !props.userConfig?.handlers?.theme)
            ) {
                return false
            }

            return true
        })

        return items
    }, [props?.selectedItems?.selectedUserGroupId])

    return (
        <div className={`AccountMenu__container ${classes.container}`}>
            <TextButton className={classes.anchorButton} onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar className={classes.avatar}>{`${user._firstname[0]}${user._lastname[0]}`}</Avatar>
                {user._fullname}
                <img className={classes.arrowDown} src={ArrowDownIcon} />
            </TextButton>
            <Menu
                className={classes.menu}
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClick={() => setAnchorEl(null)}
            >
                <div className={classes.menuHeader}>
                    <h5 className={classes.menuHeaderName}>{user._fullname}</h5>
                    <span className={classes.menuHeaderEmail}>{user._email}</span>
                </div>
                {menuItems.map(option => (
                    <MenuItem key={option.label} className={classes.menuItem} onClick={option.onClick}>
                        {option.label}
                        <img className={classes.menuItemArrow} src={ArrowDownIcon} />
                    </MenuItem>
                ))}
                <div className={classes.appVersion}>App version: {version?.version}</div>
                <div className={classes.projVersion}>Project version: {projectVersion}</div>
            </Menu>
        </div>
    )
}

export default AccountMenu
