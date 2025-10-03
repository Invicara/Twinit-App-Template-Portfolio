import React, {useState, useEffect, useMemo, useRef} from 'react';
import {
    Grid, Button, Box, MenuItem, TextField, Select, Typography, InputAdornment, FormControl, makeStyles
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import GenericErrorBoundary from "../../../components/GenericErrorBoundary.jsx";

const useStyles = makeStyles(() => ({
    formControl: {
        width: 258,
        '& .MuiOutlinedInput-root': {
            height: 36,
            borderRadius: 4,
            '& .MuiSelect-select': {
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                boxSizing: 'border-box',
            },
        },
    },
    placeholder: { color: '#B8B8B8', fontFamily: 'Inter, sans-serif', fontWeight: 400, marginTop: 5 },
    textField: {
        width: 532,
        paddingBottom: 8,
        '& input::placeholder': { color: '#B8B8B8', fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '14px' },
        '& .MuiOutlinedInput-root': { borderRadius: 4, '& input': { height: 36, padding: 0, color: '#000000' } },
    },
    label: { color: '#1D1D1D', fontWeight: 500, fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '19px', display: 'block', paddingTop: 5 },
    inputText: { color: '#B8B8B8', transform: 'translate(0px, 1.5px)' },
    searchIcon: { width: 16, height: 16, position: 'relative', top: 2.67, left: 2.67, transform: 'rotate(0deg)', opacity: 1, color: '#5D5D5D' },
    divider: { border: 'none', height: '1px', borderTop: '1px solid #EBEBEB', marginBottom: 24, width: 532, marginTop: 0, marginLeft: 'auto', marginRight: 'auto' },
}));

export default function SearchPanel({
                                        context = {},
                                        handler,
                                        initialFilter,
                                        onSubmit,
                                        formConfig
                                    }) {
    const classes = useStyles();

    // Labels (formConfig.fields[key].label > userConfig override > defaults)
    const defaultLabels = {
        search: 'Search',
        group: 'Group',
        structure: 'Unit Name / Location',
        location: 'Locations / Regions',
        status: 'Status',
    };
    const labelsFromUserConfig = handler?.config?.labels || {};
    const labels = useMemo(() => {
        const map = { ...defaultLabels, ...labelsFromUserConfig };
        for (const key of Object.keys(formConfig?.fields || {})) {
            if (formConfig.fields[key]?.label) map[key] = formConfig.fields[key].label;
        }
        return map;
    }, [formConfig, labelsFromUserConfig]);

    // Filters state
    const [filters, setFilters] = useState(() => ({
        ...(formConfig?.initial || {
            search: '',
            group: '',
            structure: '',
            location: '',
            status: '',
        }),
    }));

    // Build select options from context
    const selectOptions = useMemo(() => {
        const out = {};
        for (const [key, cfg] of Object.entries(formConfig?.fields || {})) {
            if (cfg.type === 'select') {
                const list = typeof cfg.options === 'function' ? cfg.options({context, out, filters}) : (cfg.options || []);
                out[key] = (list || []).map((opt) =>
                    typeof opt === 'object' ? opt : { value: opt, label: String(opt) }
                );
            }
        }
        return out;
    }, [formConfig, context, filters]);

    const selectedOptionsRef = useRef(selectOptions);
    useEffect(()=>{
        selectedOptionsRef.current = selectOptions
    },[selectOptions])

    useEffect(() => {
        // Flatten rules from {op:'and'|'or'|...} into a simple array of leaf nodes
        const gatherLeaves = (node, acc = []) => {
            if (!node) return acc;
            if ('fn' in node) { acc.push(node); return acc; }
            if (node.op === 'not') return gatherLeaves(node.rule, acc);
            if (node.op === 'and' || node.op === 'or') {
                for (const r of node.rules || []) gatherLeaves(r, acc);
            }
            return acc;
        };

        const defaultForField = (key, cfg) => {
            if (cfg?.default !== undefined) return cfg.default;
            if (cfg?.initial !== undefined) return cfg.initial;
            return ''; // safe empty for text/selects
        };

        const leaves = gatherLeaves(initialFilter, []);

        // For each field, if it has fromRule, try to find a matching leaf and set value
        setFilters((prev) => {
            const next = { ...prev };
            for (const [key, cfg] of Object.entries(formConfig?.fields || {})) {
                if (typeof cfg.fromRule !== 'function') continue;
                // let a field decide which leaf is relevant (it can check rule.fn/args)
                const matchingValue =
                    leaves
                        .map((leaf) => cfg.fromRule(leaf, context, selectedOptionsRef.current[key]))
                        .find((v) => v !== undefined && v !== null);
                next[key] = (matchingValue !== undefined && matchingValue !== null)
                    ? matchingValue
                    : defaultForField(key, cfg);
            }
            debugger;
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialFilter, formConfig, context]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const rules = [];
        for (const [key, value] of Object.entries(filters)) {
            const cfg = formConfig.fields?.[key];
            if (!cfg || !cfg.toRule) continue;

            if (cfg.type === 'select') {
                const opt = (selectOptions[key] || []).find((o) => String(o.value) === String(value));
                const node = cfg.toRule(value, context, opt?.meta);
                if (node) rules.push(node);
            } else {
                const node = cfg.toRule(value, context);
                if (node) rules.push(node);
            }
        }

        const globalFilter = formConfig.compile ? formConfig.compile(rules) : (rules.length ? { op: 'and', rules } : null);
        onSubmit?.(globalFilter, filters);
    };

    return (
        <div>
            <Box display='flex' justifyContent='center' pb={4}>
                <form onSubmit={handleSubmit}>
                    <Grid container spacing={2}>
                        {/* SEARCH */}
                        <Grid item xs={12}>
                            <Typography variant="body1" className={classes.label}>{labels.search}</Typography>
                            <TextField
                                fullWidth
                                variant="outlined"
                                name="search"
                                placeholder={labels.search}
                                value={filters.search || ''}
                                onChange={handleChange}
                                className={classes.textField}
                                InputProps={{
                                    classes: { input: classes.inputText },
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon className={classes.searchIcon} />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Grid>

                        {/* GROUP */}
                        <Grid item>
                            <Typography variant="body1" className={classes.label}>{labels.group}</Typography>
                            <FormControl variant="outlined" className={classes.formControl}>
                                <Select
                                    name="group"
                                    value={filters.group ?? ''}
                                    onChange={handleChange}
                                    displayEmpty
                                    IconComponent={KeyboardArrowDownIcon}
                                    renderValue={(selected) =>
                                        selected === '' || selected == null
                                            ? <span className={classes.placeholder}>Choose</span>
                                            : (selectOptions.group?.find(o => String(o.value) === String(selected))?.label ?? selected)
                                    }
                                >
                                    <MenuItem key={'all'} value=''>All</MenuItem>
                                    {(selectOptions.group || []).map((opt) => (
                                        <MenuItem key={String(opt.value)} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* LOCATION */}
                        <Grid item>
                            <Typography variant="body1" className={classes.label}>{labels.location}</Typography>
                            <FormControl variant="outlined" className={classes.formControl}>
                                <Select
                                    name="location"
                                    value={filters.location ?? ''}
                                    onChange={handleChange}
                                    displayEmpty
                                    IconComponent={KeyboardArrowDownIcon}
                                    renderValue={(selected) =>
                                        selected === '' || selected == null
                                            ? <span className={classes.placeholder}>Choose</span>
                                            : (selectOptions.location?.find(o => String(o.value) === String(selected))?.label ?? selected)
                                    }
                                >
                                    <MenuItem key={'all'} value=''>All</MenuItem>
                                    {(selectOptions.location || []).map((opt) => (
                                        <MenuItem key={String(opt.value)} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* STRUCTURE */}
                        <Grid item>
                            <Typography variant="body1" className={classes.label}>{labels.structure}</Typography>
                            <FormControl variant="outlined" className={classes.formControl}>
                                <Select
                                    name="structure"
                                    value={filters.structure ?? ''}
                                    onChange={handleChange}
                                    displayEmpty
                                    IconComponent={KeyboardArrowDownIcon}
                                    renderValue={(selected) =>
                                        selected === '' || selected == null
                                            ? <span className={classes.placeholder}>Choose</span>
                                            : (selectOptions.structure?.find(o => String(o.value) === String(selected))?.label ?? selected)
                                    }
                                >
                                    <MenuItem key={'all'} value=''>All</MenuItem>
                                    {(selectOptions.structure || []).map((opt) => (
                                        <MenuItem key={String(opt.value)} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* STATUS (fixed name) */}
                        <Grid item>
                            <Typography variant="body1" className={classes.label}>{labels.status}</Typography>
                            <FormControl variant="outlined" className={classes.formControl}>
                                <Select
                                    name="status"                 // ← fixed from deployStatus
                                    value={filters.status ?? ''}  // ← state key is 'status'
                                    onChange={handleChange}
                                    displayEmpty
                                    IconComponent={KeyboardArrowDownIcon}
                                    renderValue={(selected) =>
                                        selected === '' || selected == null
                                            ? <span className={classes.placeholder}>Choose</span>
                                            : (selectOptions.status?.find(o => String(o.value) === String(selected))?.label ?? selected)
                                    }
                                >
                                    <MenuItem key={'all'} value=''>All</MenuItem>
                                    {(selectOptions.status || []).map((opt) => (
                                        <MenuItem key={String(opt.value)} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <Button type="submit" variant="contained" color="primary" fullWidth>
                                Search
                            </Button>
                        </Grid>
                    </Grid>
                </form>
            </Box>
            <Box className={classes.divider} />
        </div>
    );
}
