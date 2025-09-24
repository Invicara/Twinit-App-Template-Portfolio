import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import clsx from 'clsx';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import Collapse from '@material-ui/core/Collapse';
import CloseIcon from '@material-ui/icons/Close';
import IconButton from '@material-ui/core/IconButton';
import {red} from '@material-ui/core/colors';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import {Button, Divider} from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
    root: {
        //maxWidth: 345,
        minWidth: 150,
        backdropFilter: "blur(5px)"
    },
    // headerRoot: {
    //     paddingTop: theme.spacing(1),
    //     paddingBottom: theme.spacing(0.5),
    // },
    // action: {
    //     marginTop: "-3px",
    // },
    // title:{
    //     fontWeight:"700"
    // },
    // media: {
    //     height: 0,
    //     paddingTop: '56.25%', // 16:9
    // },
    // expand: {
    //     transform: 'rotate(0deg)',
    //     marginLeft: 'auto',
    //     transition: theme.transitions.create('transform', {
    //         duration: theme.transitions.duration.shortest,
    //     }),
    // },
    // expandOpen: {
    //     transform: 'rotate(180deg)',
    // },
    // avatar: {
    //     backgroundColor: red[500],
    // },
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
            {/* {!disableCardHeader && <CardHeader
                classes={{root: classes.headerRoot, action: classes.action, title:classes.title}}
                avatar={null}
                action={onClose ?
                    <IconButton size="small" aria-label="close" onClick={handleClose}>
                        <CloseIcon />
                    </IconButton> : null
                }
                title={title}
                titleTypographyProps={{variant:'subtitle1'}}
                subheader={subheader}
            />}
            <Divider component="hr" />
            {mediaComponent}
            <CardContent>
                {contentComponent}
            </CardContent>

            {expandedContentComponent &&
            <div>
                <CardActions disableSpacing>
                    <IconButton
                        className={clsx(classes.expand, {
                            [classes.expandOpen]: expanded,
                        })}
                        onClick={handleExpandClick}
                        aria-expanded={expanded}
                        aria-label="show more"
                    >
                        <ExpandMoreIcon />
                    </IconButton>
                </CardActions>
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <CardContent>
                        {expandedContentComponent}
                    </CardContent>
                </Collapse>
            </div>}
            {(onCancel || onConfirm) &&
                <CardActions className={classes.actions}>
                    {onCancel && <Button color="primary" variant="outlined" size="large" onClick={onCancel}> Cancel </Button>}
                    {onConfirm && <Button color="primary" variant="contained" size='large' onClick={onConfirm}> Confirm </Button>}
                </CardActions>
            } */}
        </Card>
    );
}


