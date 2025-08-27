import React, { useEffect, useMemo, useRef, useState } from "react";
import { toTitleCase } from "../../../services/utils";
import { Divider, Grid, TextField, Tooltip, Typography, IconButton, makeStyles } from "@material-ui/core";
import { CancelOutlined, EditOutlined, InfoOutlined } from "@material-ui/icons";
import _ from "lodash";


const useStyles = makeStyles(() => ({
    iconButton: {
        fontSize: 16
    },
    title: {
        whiteSpace: 'normal'
    },
    input: {
        marginTop: 5,
        '& .MuiInputBase-input': {
            fontSize: 16,
            color: 'grey',
        }
    },
    inputEdit: {
        marginTop: 5,
        '& .MuiInputBase-input': {
            borderRadius: 4,
            padding: 8,
            fontSize: 16,
            border: `1px solid #999999`,
        }
    },
}));

export const InfoComponent = ({ entity, handleChange, type, entityType, originalEntity }) => {
    const [openEdit, setIsEdit] = useState(false);
    const initialLocalValue = useMemo(() => {
        if (entityType === "Site") {
            return entity || {};
        } else {
            // For custom objects with attributes
            return entity?.attributes || entity || {};
        }
    }, [entity, entityType]);
    
    const [localValue, setLocalValue] = useState(initialLocalValue);
    const classes = useStyles();

    const handleUpdate = (e, name) => {
        const newValue = e.target.value;
        setLocalValue({ ...localValue, [name]: newValue });
        
        // Call the onChange handler with the new value
        if (entityType === "Site") {
            handleChange && handleChange(newValue, name, { name, entityType, entity, originalEntity });
        } else {
            handleChange && handleChange(newValue, `attributes.${name}`, { name, entityType, entity, originalEntity });
        }
    };

    const entityRef = useRef(entity);
    useEffect(() => {
        // Avoid initial onChange to be fired
        if (_.isEqual(entityRef.current, entity)) {
            return;
        }
        if (entityType === "Site") {
            setLocalValue(entity || {});
        } else {
            // For custom objects with attributes
            setLocalValue(entity?.attributes || {});
        }
        entityRef.current = entity;
    }, [entity, entityType]);

    return (
        <>
            {!type?.length || !entity ? (
                <div>No data to edit.</div>
            ) : (
                type?.map((prop, i) => (
                    <React.Fragment key={prop[0]}>
                        <Grid style={{justifyContent: "space-between", alignItems: "center"}} container>
                            <Grid item xs={4}>
                                <Typography
                                    variant="body2"
                                    className={classes.title}
                                >
                                    {toTitleCase(prop[1].title || prop[0])}:
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    inputProps={{
                                        maxLength: 50,
                                        readOnly: openEdit !== prop[0]
                                    }}
                                    className={openEdit === prop[0] ? classes.inputEdit : classes.input}
                                    value={localValue && localValue[prop[0]] || ''}
                                    onChange={(e) => handleUpdate(e, prop[0])}
                                    onBlur={() => setIsEdit(false)}
                                />
                            </Grid>
                            <Grid item xs={1}>
                                <Tooltip
                                    title={
                                        openEdit === prop[0]
                                            ? 'Close Edit'
                                            : prop[1].readOnly
                                                ? prop[1].description || 'This property is not editable'
                                                : 'Edit'
                                    }
                                    placement="bottom"
                                >
                                    <IconButton
                                        onClick={
                                            openEdit === prop[0]
                                                ? () => setIsEdit(false)
                                                : prop[1].readOnly
                                                    ? null
                                                    : () => setIsEdit(prop[0])
                                        }
                                        size="small"
                                    >
                                        {openEdit === prop[0] ? (
                                            <CancelOutlined className={classes.iconButton} />
                                        ) : prop[1].readOnly ? (
                                            <InfoOutlined className={classes.iconButton} />
                                        ) : (
                                            <EditOutlined className={classes.iconButton} />
                                        )}
                                    </IconButton>
                                </Tooltip>
                            </Grid>
                        </Grid>
                        {type.length !== i + 1 && <Divider />}
                    </React.Fragment>
                ))
            )}
        </>
    );
};

