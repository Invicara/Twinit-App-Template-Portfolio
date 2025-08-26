import React, { useMemo, useContext } from 'react';
import { makeStyles } from '@material-ui/core';
import { MapStateContext } from '../PortfolioOverview';
import {Link, Tooltip, Typography} from "@mui/material";
import HomeIcon from '@mui/icons-material/Home';
import _ from "lodash";

const useStyles = makeStyles((theme) => ({
    container: {
        height: 40,
        display: "flex",
        alignItems: "center",
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
    homeLink: { display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: '4px' }
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
    const { currentState, send } = useContext(MapStateContext);

    const context = currentState?.context ?? {};
    const chain = getActiveChain(currentState?.value ?? {});
    // chain is like ['portfolio','site','building','modelElement'] depending on where we are

    // map chain to level defs (from namedPath)
    const levels = chain
        .map(stateName => namedPath.find(l => l.state === stateName))
        .filter(Boolean); // only those defined in namedPath

    if (levels.length === 0) {
        return null;
    }

    return (
        <div className={classes.container}>
            {/* Home crumb */}
            <Tooltip title="Home">
                <Link
                    underline="hover"
                    onClick={() => send(buildGoToHome(namedPath))}
                    className={classes.homeLink}
                >
                    <HomeIcon fontSize="small"  />
                </Link>
            </Tooltip>
            {/* Intermediate crumbs (excluding the first top-most if it has no idKey or label) */}
            {levels.map((lvl, idx) => {
                const isLast = idx === levels.length - 1;
                const idKey = lvl.idKey;
                const idVal = idKey ? context[idKey] : undefined;
                const label = getLabel ? getLabel(lvl, context) : _.startCase(lvl.state);;

                // For the current level (last), render as text; others are clickable links that bubble up
                if (isLast) {
                    return (
                        <Tooltip
                            key={lvl.state}
                            title={idKey ? `${idKey}: ${idVal ?? '(none)'}` : 'Home'}
                            placement="bottom"
                        >
                            <Typography key={lvl.state} fontSize={"small"} className={currentState.matches(lvl.state) ? classes.activeCrumb : classes.crumb}>
                                {label}{idKey ? `: ${idVal ?? ''}` : ''}
                            </Typography>
                        </Tooltip>
                    );
                }

                return (
                    <>
                    <Tooltip
                        key={lvl.state}
                        title={idKey ? `${idKey}: ${idVal ?? '(none)'}` : 'Home'}
                        placement="bottom"
                    >
                        <Link
                            underline="hover"
                            onClick={() => send(buildGoToEventForLevel(namedPath, context, idx))}
                            sx={{ cursor: 'pointer' }}
                        >
                            <Typography key={lvl.state} fontSize={"small"} className={currentState.matches(lvl.state) ? classes.activeCrumb : classes.crumb}>
                                {label}{idKey ? `: ${idVal ?? ''}` : ''}
                            </Typography>
                        </Link>
                    </Tooltip>
                    <span className={classes.separator}>/</span>
                    </>
                );
            })}
        </div>
    );
};

export default PortfolioBreadCrumbs;
