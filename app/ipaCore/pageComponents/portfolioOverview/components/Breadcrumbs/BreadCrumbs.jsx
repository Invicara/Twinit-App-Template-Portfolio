import React, { useContext } from 'react';
import { makeStyles } from '@material-ui/core';
import { useSelector as useXstateSelector } from '@xstate/react';
import { MapContext, MapMachineContext } from '../../PortfolioOverview';
import {Link, Tooltip, Typography} from "@material-ui/core";
import HomeIcon from '@material-ui/icons/Home';
import _ from "lodash";
import AddSiteSection from './AddSiteSection';
import { getActiveLevels } from '../../../../../services/utils';

const useStyles = makeStyles((theme) => ({
    container: {
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 14,
        paddingRight: 14,
        width: "100%"
    },
    breadcrumbsSection: {
        display: "flex",
        alignItems: "center"
    },
    crumb: {
        fontWeight: 500,
        margin: 20,
        marginLeft: 0,
        cursor: "pointer",
        color: "white",
        '&:hover': {
            textDecoration: "underline"
        }
    },
    activeCrumb: {
        fontWeight: "700 !important",
        margin: 20,
        marginLeft: 0,
        cursor: "pointer",
        color: "white",
        '&:hover': {
            textDecoration: "underline"
        }
    },
    separator: {
        margin: "0px 10px",
        color: "white"
    },
    addSiteSection: {
        display: "flex",
        alignItems: "center",
        height: "100%",
        padding: "0 12px",
        cursor: "pointer",
        color: "white",
        borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
        transition: "background-color 0.2s ease",
        '&:hover': {
            backgroundColor: "rgba(255, 255, 255, 0.1)"
        }
    },
    addSiteSectionActive: {
        display: "flex",
        alignItems: "center",
        height: "100%",
        padding: "0 12px",
        cursor: "pointer",
        color: "#CC3289",
        borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
        backgroundColor: "rgba(204, 50, 137, 0.1)",
        '&:hover': {
            backgroundColor: "rgba(204, 50, 137, 0.2)"
        }
    },
    pinIcon: {
        marginRight: 6,
        width: 16,
        height: 16,
        fill: "currentColor"
    },
    addSiteText: {
        fontSize: 13,
        fontWeight: 500
    },
    homeLink: {
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        padding: '4px'
    }
}));

/**
 * Extract full hierarchical path keys from XState v5 snapshot.value
 * e.g. { portfolio: { site: { building: 'idle' } } } -> ['portfolio','site','building']
 */
function getActiveChain(snapshotValue) {
    const chain = [];
    let node = snapshotValue;
    while (node && typeof node === 'object') {
        const [k] = Object.keys(node);
        if (!k) break;
        chain.push(k);
        node = node[k];
    }
    return chain;
}

/**
 * Build a GO_TO payload to bubble to a certain level index.
 * - For each level <= target, include its idKey if present in context (or leave undefined to keep)
 * - For each level > target, explicitly null its idKey to bubble up
 */
function buildGoToEventForLevel(namedPath, context, targetIdx) {
    const evt = { type: 'GO_TO' };
    namedPath.forEach((lvl, idx) => {
        const { idKey } = lvl;
        if (!idKey) return; // top-most usually has no idKey
        if (idx <= targetIdx) {
            // Keep current value if present; if you want to force re-entry, you can set it explicitly
            evt[idKey] = context[idKey] ?? undefined;
        } else {
            // Null deeper ids to bubble up
            evt[idKey] = null;
        }
    });
    return evt;
}

/**
 * Build a GO_TO "home" (top) payload: null all idKeys
 */
function buildGoToHome(namedPath) {
    const evt = { type: 'GO_TO' };
    namedPath.forEach((lvl) => {
        if (lvl.idKey) evt[lvl.idKey] = null;
    });
    return evt;
}

const PortfolioBreadCrumbs = ({namedPath, getLabel}) => {
    const classes = useStyles();
    const { send, actor } = useContext(MapMachineContext);
    const currentState = useXstateSelector(actor, state => state);

    const context = currentState?.context ?? {};

    // map chain to level defs (from namedPath)
    const levels = getActiveLevels(currentState);

    if (levels.length === 0) {
        return (
            <div className={classes.container}>
                <div className={classes.breadcrumbsSection}>
                    {/* Empty breadcrumbs section */}
                </div>
                <AddSiteSection {...{classes}}/>
            </div>
        );
    }

    return (
        <div className={classes.container}>
            <div className={classes.breadcrumbsSection}>
                {/* Home crumb */}
                <Tooltip title="Home">
                    <Link
                        underline="hover"
                        onClick={() => send(buildGoToHome(namedPath))}
                        className={classes.homeLink}
                    >
                        <HomeIcon style={{ fontSize: 18 }} />
                    </Link>
                </Tooltip>
                {/* Intermediate crumbs (excluding the first top-most if it has no idKey or label) */}
                {levels.map((lvl, idx) => {
                    const isLast = idx === levels.length - 1;
                    const idKey = lvl.idKey;
                    const idVal = idKey ? context[idKey] : undefined;
                    const label = getLabel ? getLabel(lvl, context) : _.startCase(lvl.state);

                    // For the current level (last), render as text; others are clickable links that bubble up
                    if (isLast) {
                        return (
                            <Tooltip
                                key={lvl.state}
                                title={idKey ? `${idKey}: ${idVal ?? '(none)'}` : 'Home'}
                                placement="bottom"
                            >
                                <Typography key={lvl.state} variant="body2" className={currentState.matches(lvl.state) ? classes.activeCrumb : classes.crumb}>
                                    {label}{idKey ? `: ${idVal ?? ''}` : ''}
                                </Typography>
                            </Tooltip>
                        );
                    }

                    return (
                        <React.Fragment key={lvl.state}>
                            <Tooltip
                                title={idKey ? `${idKey}: ${idVal ?? '(none)'}` : 'Home'}
                                placement="bottom"
                            >
                                <Link
                                    underline="hover"
                                    onClick={() => send(buildGoToEventForLevel(namedPath, context, idx))}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <Typography variant="body2" className={currentState.matches(lvl.state) ? classes.activeCrumb : classes.crumb}>
                                        {label}{idKey ? `: ${idVal ?? ''}` : ''}
                                    </Typography>
                                </Link>
                            </Tooltip>
                            <span className={classes.separator}>/</span>
                        </React.Fragment>
                    );
                })}
            </div>
            <AddSiteSection {...{classes, levels}}/>
        </div>
    );
};

export default PortfolioBreadCrumbs;
