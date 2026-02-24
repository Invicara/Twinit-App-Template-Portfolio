import React, {useEffect, useMemo, useState} from 'react';
import DeployStatusChart from './DeployStatusBarChart';
import SearchPanel from './SearchPanel';
import {Box, Typography, Button, Divider} from "@mui/material";
import {useDispatch, useSelector} from "react-redux";
import {getFilter, setFilter} from "../../../redux/filters.js";
import {
    FilterCompiler,
    getGlobalFilterFunctions,
    mergeFiltersGeneric,
    toggleScopedFilter
} from "../../utils/filters.global.js";

const sampleFormConfig = {
    initial: { search: '', group: '', structure: '', location: '', status: '' },
    fields: {
        status: {
            label: 'Status',
            type: 'select',
            rule: "statusIn",
            options: (ctx) => {
                const labelMap = {
                    "1": "Planned",
                    "2": "Construction",
                    "3": "Operating",
                    "4": "Suspended Operation",
                    "5": "Permanent Shutdown",
                    "unknown": "Other",
                }
                return Object.entries(labelMap).map(([id,label]) => ({ value: id, label: label || `Status ${id}` }));
            },
            toRule: (value) => (value !== '' ? { fn: 'statusIn', args: { values: [value] } } : null),
            fromRule: (rule) => (rule.fn === 'statusIn' && Array.isArray(rule.args?.values) ? rule.args.values[0] : null),
        },
        group: {
            label: 'Group',
            type: 'select',
            rule: "buildingTypeIn",
            options: () => {
                    const bins = [
                    { id: "typeA", color: "#8ecbff", test: "buildingTypeIn", label: "Type A" },
                    { id: "typeB", color: "#1DC0F7", test: "buildingTypeIn", label: "Type B" },
                    { id: "typeC", color: "#0072BC", test: "buildingTypeIn", label: "Type C" },
                    { id: "typeD", color: "#1D1D1D", test: "buildingTypeIn", label: "Type D" }
                ];
                return bins.map((bin, index) => ({ value: bin.id, label: bin.label, meta: { bin } }));
            },
            toRule: (value, _ctx, meta) => {
                return value !== '' && meta?.bin
                    ? {fn: 'buildingTypeIn', args: {values: [value]}}
                    : null
            },
            fromRule: (rule, _context, selectOptions = []) => {
                if (rule?.fn !== 'buildingTypeIn') return null;

                // normalize the values coming from the rule
                const ids = Array.isArray(rule.args?.values)
                    ? rule.args.values.map(String)
                    : rule.args?.id != null
                        ? [String(rule.args.id)]
                        : [];

                if (!ids.length) return null;

                // Try to match by option.value first, then by meta.bin.id
                const opt = selectOptions.find(opt => {
                    const v = String(opt.value);
                    const binId = String(opt.meta?.bin?.id ?? '');
                    return ids.includes(v) || (binId && ids.includes(binId));
                });

                return opt ? opt.value : null;
            }
        },
        location: {
            label: 'Facility Location',
            type: 'select',
            rule: "facilityIn",
            options: ({context, filters}) => {
                const fns = getGlobalFilterFunctions("site", false);
                const filterCompiler = new FilterCompiler(fns);
                const rules = [sampleFormConfig.fields.group.toRule(filters['group'], context)].filter(r=>!!r);
                const filterFn = filterCompiler.compileFilter(sampleFormConfig.compile(rules));
                const bins = context?.data?.["site"] || [];
                return bins.filter(filterFn ? filterFn : Boolean).map((bin, index) => ({ value: bin.siteId, label: bin.name, meta: { bin } }));
            },
            toRule: (value, _ctx) => {
                return value !== ''
                    ? {fn: 'facilityIn', args: {values: [value]}}
                    : null
            },
            fromRule: (rule, _context, selectOptions = []) => {
                if (rule?.fn !== 'facilityIn') return null;

                // normalize the values coming from the rule
                const ids = Array.isArray(rule.args?.values)
                    ? rule.args.values.map(String)
                    : rule.args?.id != null
                        ? [String(rule.args.id)]
                        : [];

                if (!ids.length) return null;

                // Try to match by option.value first, then by meta.bin.id
                const opt = selectOptions.find(opt => {
                    const v = String(opt.value);
                    const binId = String(opt.meta?.bin?.id ?? '');
                    return ids.includes(v) || (binId && ids.includes(binId));
                });

                return opt ? opt.value : null;
            }
        },
        structure: {
            label: 'Unit Name / Structure',
            type: 'select',
            rule: "unitIn",
            options: ({context, filters}) => {
                const fns = getGlobalFilterFunctions("building", false);
                const filterCompiler = new FilterCompiler(fns);
                const rules = [sampleFormConfig.fields['group'].toRule(filters['group'], context),sampleFormConfig.fields['location'].toRule(filters['location'], context)].filter(r=>!!r);
                const filterFn = filterCompiler.compileFilter(sampleFormConfig.compile(rules));
                const bins = context?.data?.["building"] || [];
                return bins.filter(filterFn ? filterFn : Boolean).map((bin, index) => ({ value: bin.buildingId, label: bin.name, meta: { bin } }));
            },
            toRule: (value, _ctx, meta) => {
                return value !== ''
                    ? {fn: 'unitIn', args: {values: [value]}}
                    : null
            },
            fromRule: (rule, _context, selectOptions = []) => {
                if (rule?.fn !== 'unitIn') return null;

                // normalize the values coming from the rule
                const ids = Array.isArray(rule.args?.values)
                    ? rule.args.values.map(String)
                    : rule.args?.id != null
                        ? [String(rule.args.id)]
                        : [];

                if (!ids.length) return null;

                // Try to match by option.value first, then by meta.bin.id
                const opt = selectOptions.find(opt => {
                    const v = String(opt.value);
                    const binId = String(opt.meta?.bin?.id ?? '');
                    return ids.includes(v) || (binId && ids.includes(binId));
                });

                return opt ? opt.value : null;
            }
        },
        search: {
            label: 'Search',
            type: 'text',
            rule: "searchQuery",
            toRule: (value) => (value?.trim() ? { fn: 'searchQuery', args: { q: value.trim() } } : null),
            fromRule: (rule) => (rule.fn === 'searchQuery' ? rule.args?.q ?? '' : null),
        },
        sample_group2: {
            label: 'Group2',
            type: 'select',
            options: () => {
                const edges = [0, 100, 250, 1000];
                const names = ['Small', 'Medium', 'Large'];
                return names.map((label, index) => ({ value: index, label, meta: { edges } }));
            },
            toRule: (value, _ctx, meta) =>
                value !== '' && meta?.edges
                    ? { fn: 'amountInBins', args: { edges: meta.edges, index: Number(value) } }
                    : null,
            fromRule: (rule) =>
                rule.fn === 'amountInBins' && Number.isFinite(rule.args?.index) ? Number(rule.args.index) : null,
        },

        // ...structure, location similarly...
    },
    compile(rules) {
        const clean = rules.filter(Boolean);
        return clean.length ? { op: 'and', rules: clean } : null;
    },
};

const defaultChartCfg =  {
    // 1) where items come from
    itemsOf: (data /* context.data */) => {
        const sites = Array.isArray(data?.site) ? data.site : [];
        return sites.flatMap(s => Array.isArray(s.buildings) ? s.buildings : []);
    },

    // 2) GROUP
            group: {
                id: 'buildingTypeIn',
            bins: [
        {
            id: 'typeA',
            label: 'Type A',
            color: '#8ecbff',
            test: (b) => {
                 const cap = b?.Type;
            return cap == 'Type A';
            },
        },
        {
            id: 'typeB',
            label: 'Type B',
            color: '#1DC0F7',
            test: (b) => {
                 const cap = b?.Type;
            return cap == 'Type B';
            },
        },
        {
            id: 'typeC',
            label: 'Type C',
            color: '#0072BC',
             test: (b) => {
                 const cap = b?.Type;
            return cap == 'Type C';
            },
        },
        {
            id: 'typeD',
            label: 'Type D',
            color: '#1D1D1D',
            test: (b) => {
            const cap = b?.Type;
            return cap == 'Type D';
            },
        },
        {
            id: 'Other',
            label: 'Other',
            test: () => true,
        },
        ],
        groupLabel: (bin) => bin.label,
    },

    // 3) SERIES: StatusId → stacks, with label/color maps (1–5 only; 7, 5.6, null, etc. → Other)
    series: {
        id: 'statusIn',
        keyProp: (b) => {
            const s = b?.StatusId;
            const known = ['1', '2', '3', '4', '5'];
            return (s != null && known.includes(String(s))) ? String(s) : 'unknown';
        },
        config: {
             colorMap: {
                "1": "#d3d3d3",   // Not started / Planned (adjust if you want your old palette)
                "2": "#f4b740",   // In Progress / Construction
                "3": "#66bb6a",   // Completed / Operating
                "4": "#e53935",   // At risk / Suspended Operation
                "5": "#6B7280",   // Permanent Shutdown
                "unknown": "#CCCCCC",
        },
            labelMap: {
                "1": "Planned",
                "2": "Construction",
                "3": "Operating",
                "4": "Suspended Operation",
                "5": "Permanent Shutdown",
                "unknown": "Other",
            },
        },
        // keep a stable legend order
        order: (keys) => {
            const pref = ['1','2','4','3','5','unknown']; // your desired sequence
            return pref.filter(k => keys.includes(k)).concat(keys.filter(k => !pref.includes(k)));
        },
    },

    // 4) METRIC
    metric: { type: 'count' },

    // 5) Click → filters
    filter: {
        scope: 'site',
        combine: 'and',
        rules: {
            series: (statusKey) =>
                ({ fn: 'statusIn', args: { values: [statusKey] } }),
            group:  (id, ctx) => ({ fn: 'buildingTypeIn', args: { values: [ctx.bin.id] } }),
        },
    },
};

function hasActiveSiteFilter(globalFilters) {
    const siteFilter = globalFilters?.site;
    if (!siteFilter || typeof siteFilter !== 'object') return false;
    if (siteFilter.fn) return true;
    if (siteFilter.op && Array.isArray(siteFilter.rules) && siteFilter.rules.length > 0) return true;
    return false;
}

export default function PortfolioDetails({ context, userConfig, snapshot, send, stateKey, handler }) {

    const globalFilters = useSelector(getFilter)
    const dispatch = useDispatch();

    const { filteredSiteCount, totalSiteCount, siteFilterActive } = useMemo(() => {
        const sites = Array.isArray(context?.data?.site) ? context.data.site : [];
        const active = hasActiveSiteFilter(globalFilters);
        if (!active) {
            return { filteredSiteCount: sites.length, totalSiteCount: sites.length, siteFilterActive: false };
        }
        try {
            const fns = getGlobalFilterFunctions("site", false);
            const compiler = new FilterCompiler(fns);
            const filterNode = globalFilters?.site ?? null;
            const filterFn = compiler.compileFilter(filterNode);
            const filtered = sites.filter(filterFn ?? Boolean);
            return { filteredSiteCount: filtered.length, totalSiteCount: sites.length, siteFilterActive: true };
        } catch (e) {
            console.warn("PortfolioDetails filter count", e);
            return { filteredSiteCount: 0, totalSiteCount: sites.length, siteFilterActive: true };
        }
    }, [context?.data?.site, globalFilters]);

    const handleClearSiteFilters = () => {
        dispatch(setFilter({ ...globalFilters, site: null }));
    };

    useEffect(()=>{
        send({ type: 'UPDATE_FILTERS', filters: globalFilters });
    },[globalFilters]);


    return (
        <div>
            <Box pl={2} pr={2} pt={2}>
                <SearchPanel
                    initialFilter={globalFilters["site"]}
                    userConfig={userConfig}
                    context={context}
                    stateKey={stateKey}
                    handler={handler}
                    formConfig={sampleFormConfig}
                    onSubmit={(filter, rawFilters) => {
                        const mergingOptions = {
                            dropMissing: Object.values(sampleFormConfig.fields).map(c=>c.rule).filter(r=>!!r),
                            replace: (fn) => Object.values(sampleFormConfig.fields).map(c=>c.rule).filter(r=>!!r).includes(fn)
                        }
                        const merged = mergeFiltersGeneric(globalFilters, filter, "site", mergingOptions);
                        console.log("mergeFiltersGeneric SearchPanel", {merged, filter, globalFilters, mergingOptions})
                        dispatch(setFilter(merged));
                    }}
                />

                <Box sx={{ minHeight: 20, mb: 0.5 }}>
                    {siteFilterActive && (
                        <Typography variant="body2" color="textSecondary">
                            {filteredSiteCount === 0 ? (
                                <>
                                    No sites match your search.
                                    <Button size="small" color="primary" onClick={handleClearSiteFilters} sx={{ ml: 0.5, textTransform: 'none', minWidth: 'auto', p: 0 }}>
                                        Clear filters
                                    </Button>
                                </>
                            ) : (
                                <>Showing {filteredSiteCount} {filteredSiteCount === 1 ? 'site' : 'sites'}{totalSiteCount !== filteredSiteCount ? ` of ${totalSiteCount}` : ''}</>
                            )}
                        </Typography>
                    )}
                </Box>

                <Divider sx={{ border: 'none', borderTop: '1px solid #EBEBEB', marginBottom: 3, marginTop: 0 }} />

                <DeployStatusChart
                    initialFilter={globalFilters["site"]}
                    handler={handler}
                    context={context}
                    snapshot={snapshot}
                    send={send}
                    stateKey={stateKey}
                    chartCfg={defaultChartCfg}
                    onFilterChange={(filter, options) => {
                        const mergingOptions = {
                            dropMissing: [defaultChartCfg.group.id, defaultChartCfg.series.id],
                            replace: options?.replace !== false
                        };
                        const merged = mergeFiltersGeneric(globalFilters, filter, "site", mergingOptions);
                        console.log("mergeFiltersGeneric DeployStatusChart", {merged, filter, globalFilters, mergingOptions});
                        dispatch(setFilter(merged));
                    }}
                />
            </Box>
        </div>
    );
}