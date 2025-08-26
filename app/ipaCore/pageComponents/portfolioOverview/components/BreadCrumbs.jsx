import React, { useMemo, useContext } from 'react';
import { makeStyles } from '@material-ui/core';
import { PortfolioActorContext } from '../PortfolioOverview';

// Helper function to execute callbacks sequentially with intervals
function executeSequentialCallbacks(callbacks, intervalMs = 100) {
    if (!Array.isArray(callbacks) || callbacks.length === 0) {
        console.warn('executeSequentialCallbacks: No callbacks provided');
        return;
    }
    
    let currentIndex = 0;
    
    const intervalId = setInterval(() => {
        if (currentIndex >= callbacks.length) {
            clearInterval(intervalId);
            return;
        }
        
        const callback = callbacks[currentIndex];
        if (typeof callback === 'function') {
            try {
                callback();
            } catch (error) {
                console.error(`Error executing callback ${currentIndex}:`, error);
            }
        } else {
            console.warn(`Callback at index ${currentIndex} is not a function:`, callback);
        }
        
        currentIndex++;
    }, intervalMs);
    
    return intervalId; // Return interval ID in case caller wants to clear it manually
}

const useStyles = makeStyles((theme) => ({
    container: {
        height: 40,
        display: "flex",
        alignItems: "center",
        paddingLeft: 14
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
        fontWeight: 700,
        margin: 20,
        marginLeft: 0,
        cursor: "pointer",
        color: "white",
        '&:hover': {
            textDecoration: "underline"
        }
    },
    separator: {
        marginRight: 10
    }
}));

const PortfolioBreadCrumbs = () => {
    const classes = useStyles();
    const { currentState, send } = useContext(PortfolioActorContext);
    
    const breadcrumbs = useMemo(() => {
        if (!currentState) return [];
        
        const crumbs = [];
        const stateValue = currentState.value;
        const context = currentState.context;
        
        // Helper function to get nested state value
        const getNestedStateValue = (value) => {
            if (typeof value === 'string') return [value];
            if (typeof value === 'object') {
                const result = [];
                for (const [key, nestedValue] of Object.entries(value)) {
                    result.push(key);
                    if (typeof nestedValue === 'object') {
                        result.push(...getNestedStateValue(nestedValue));
                    } else if (typeof nestedValue === 'string') {
                        result.push(nestedValue);
                    }
                }
                return result;
            }
            return [];
        };
        
        const states = getNestedStateValue(stateValue);
        console.log('BreadCrumbs - States:', states, 'Context:', context);
        
        // Portfolio level (always present)
        crumbs.push({
            title: 'Portfolio',
            isActive: states.includes('portfolio') && !context.siteId,
            onClick: () => {
                executeSequentialCallbacks([
                    () => send({ type: 'GO_TO' }),
                    () => send({ type: 'CONFIRM_YES' })
                ], 100);
            }
        });
        
        // Site level
        if (states.includes('site') && context.siteId) {
            const siteData = context.data?.site?.find(s => s.siteId === context.siteId);
            crumbs.push({
                title: siteData?.name || `Site ${context.siteId}`,
                isActive: states.includes('site') && !states.includes('building'),
                onClick: () => {
                    executeSequentialCallbacks([
                        () => send({ 
                            type: 'GO_TO', 
                            siteId: context.siteId 
                        }),
                        () => send({ 
                            type: 'CONFIRM_YES' 
                        })
                    ], 100);
                }
            });
        }
        
        // Building level
        if (states.includes('building') && context.buildingId) {
            const buildingData = context.data?.building?.find(b => b.buildingId === context.buildingId);
            crumbs.push({
                title: buildingData?.name || `Building ${context.buildingId}`,
                isActive: states.includes('building') && !states.includes('modelElement'),
                onClick: () => {
                    executeSequentialCallbacks([
                        () => send({ 
                            type: 'GO_TO', 
                            siteId: context.siteId,
                            buildingId: context.buildingId 
                        }),
                        () => send({ 
                            type: 'CONFIRM_YES' 
                        })
                    ], 100);
                }
            });
        }
        
        // Model Element level
        if (states.includes('modelElement') && context.modelElementId) {
            crumbs.push({
                title: `Model: ${context.modelElementId}`,
                isActive: true, // This is the deepest level
                onClick: () => {
                    executeSequentialCallbacks([
                        () => send({ 
                            type: 'GO_TO', 
                            siteId: context.siteId,
                            buildingId: context.buildingId,
                            modelElementId: context.modelElementId 
                        }),
                        () => send({ 
                            type: 'CONFIRM_YES' 
                        })
                    ], 100);
                }
            });
        }
        
        return crumbs;
    }, [currentState, send]);
    
    if (breadcrumbs.length === 0) {
        return null;
    }
    
    return (
        <div className={classes.container}>
            {breadcrumbs.map((crumb, index) => {
                return (
                    <span 
                        className={crumb.isActive ? classes.activeCrumb : classes.crumb}
                        onClick={crumb.onClick} 
                        key={`${crumb.title}-${index}`}
                    >
                        {index > 0 && <span className={classes.separator}>/</span>}
                        {crumb.title}
                    </span>
                );
            })}
        </div>
    );
};

export default PortfolioBreadCrumbs;
