import React, {useCallback} from 'react';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import {makeStyles} from "@material-ui/core/styles";
import {Divider, Grid} from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
    root: {
        width: 'fit-content',
        paddingBottom: theme.spacing(1),
        //border: `1px solid ${theme.palette.divider}`,
        //borderRadius: theme.shape.borderRadius,
        //backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.secondary,
        //'& svg': {
        //    margin: theme.spacing(1.5),
        //},
        //'& hr': {
        //    margin: theme.spacing(0, 0.5),
        //},
    },
    metricContainer: {
        display: "flex",
        alignItems: "flex-start"
    },
    metricItem: {
        padding: `0px ${theme.spacing(1)}px`
    }
}));



export default function MetricInfoType2({metrics}) {

    const classes = useStyles();
    
    const generateMetricSegment = useCallback((metric, index)=>{
        const {value, unit, displayValue, label, icon} = metric;
        let updatedValue = displayValue  && displayValue != '-' ?  displayValue : value ? value : displayValue
        updatedValue = typeof updatedValue === 'number' ? Math.round(updatedValue).toLocaleString() : updatedValue
        return <Grid key={index} item>
                <Box className={classes.metricContainer}>
                {icon && <Box className={classes.metricItem} textAlign="left" style={{alignSelf: "center"}}>{icon}</Box>}
                <Box className={classes.metricItem}>
                    <Typography variant="caption"><Box color="success.main" textAlign="left">{label}</Box></Typography>
                    <Box style={{ display: "flex", alignItems: "baseline" }}>
                        <Typography variant={"span"} style={{ lineHeight: 1 }}><Box color="text.primary" textAlign="left">{updatedValue}</Box></Typography>
                        <Typography variant={"span"} style={{ lineHeight: 1 }}><Box color="text.primary" textAlign="center" alignSelf="baseline" style={{ paddingLeft: 2, paddingRight: 2, fontWeight: "400" }}>{unit}</Box></Typography>
                    </Box>
                </Box>
                </Box>
            </Grid>

    },[]);

    return (
        <div>
            <Grid container alignItems="center" className={classes.root}>
                { metrics && metrics.map((metric,index)=> <>
                    {generateMetricSegment(metric, index, metrics)}
                    {index < metrics.length-1 && <Divider flexItem orientation="vertical"></Divider>}
                </>)}
            </Grid>
        </div>
    );
}