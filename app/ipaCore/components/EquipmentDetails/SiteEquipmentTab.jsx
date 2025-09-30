import React from 'react';
import {makeStyles} from '@material-ui/core/styles';

import Card from '@material-ui/core/Card';


const useStyles = makeStyles((theme) => ({
   
}));

export default function SiteEquipmentTab() {
    const classes = useStyles();
    const [expanded, setExpanded] = React.useState(false);

    const handleExpandClick = () => {
        setExpanded(!expanded);
    };

    const handleClose = () => {
        onClose && onClose();
    };

    return (
        <Card classes={{root: classes.root}}>
        </Card>
    );
}


