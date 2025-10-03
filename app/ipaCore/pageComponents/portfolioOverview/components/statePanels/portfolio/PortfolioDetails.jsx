import React, {useEffect, useState} from 'react';
import DeployStatusChart from './DeployStatusBarChart.jsx';
import SearchPanel from '../../SearchPanel.jsx';
import {Box} from "@mui/material";
import {useDispatch, useSelector} from "react-redux";
import {getFilter, setFilter} from "../../../../../redux/filters.js";
import {mergeFiltersGeneric, toggleScopedFilter} from "../../../../utils/filters.global.js";


const sampleFormConfig = {
    initial: { search: '', group: '', structure: '', location: '', status: '' },
    fields: {
        status: {
            label: 'Engineering Changes Status',
            type: 'select',
            rule: "EC_statusIn",
            options: () => {
                const labelMap = {
                    "REGISTERED": "Registered",
                    "APPROVED": "Approved",
                    "CLOSED": "Closed",
                }
                return Object.entries(labelMap).map(([id,label]) => ({ value: id, label: label || `Status ${id}` }));
            },
            toRule: (value) => (value !== '' ? { fn: 'EC_statusIn', args: { values: [value] } } : null),
            fromRule: (rule) => (rule.fn === 'EC_statusIn' && Array.isArray(rule.args?.values) ? rule.args.values[0] : null),
        },
        group: {
            label: 'Palier Group',
            type: 'select',
            rule: "reactorPalierIn",
            options: () => {
                const bins = [
                    {id: 'CP0/CPY', label: 'CP0/CPY Palier', test: "reactorPalierIn", color: "#8ecbff"},
                    {id: "P4/P'4", label: "P4/P'4 Palier",test: "reactorPalierIn", color: "#1DC0F7"},
                    {id: 'N4', label: 'N4 Palier', test: "reactorPalierIn", color: "#0072BC"},
                    {id: 'Other', label: 'Other',test: () => true},
                ];
                return bins.map((bin, index) => ({ value: bin.id, label: bin.label, meta: { bin } }));
            },
            toRule: (value, _ctx, meta) => {
                return value !== '' && meta?.bin
                    ? {fn: 'reactorPalierIn', args: {values: [value]}}
                    : null
            },
            fromRule: (rule, _context, selectOptions = []) => {
                if (rule?.fn !== 'reactorPalierIn') return null;

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
            options: ({context}) => {
                const bins = context?.data?.["site"] || [];
                return bins.map((bin, index) => ({ value: bin.siteId, label: bin.name, meta: { bin } }));
            },
            toRule: (value, _ctx, meta) => {
                return value !== '' && meta?.bin
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
                const locationId = filters['location'];
                const bins = context?.data?.["building"] || [];
                return bins.filter(b=>locationId && locationId.length>0 ? b.siteId == locationId : true).map((bin, index) => ({ value: bin.buildingId, label: bin.name, meta: { bin } }));
            },
            toRule: (value, _ctx, meta) => {
                return value !== '' && meta?.bin
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
    itemType: "building",
    itemsOf: (data /* context.data */) => {
        const sites = Array.isArray(data?.site) ? data.site : [];
        return sites.flatMap(s => Array.isArray(s.buildings) ? s.buildings : []);
    },

    // 2) GROUP
    group: {
        id: 'reactorPalierIn',
        bins: [
            {id: 'CP0/CPY', label: 'CP0/CPY Palier', test: "reactorPalierIn", color: "#8ecbff"},
            {id: "P4/P'4", label: "P4/P'4 Palier",test: "reactorPalierIn", color: "#1DC0F7"},
            {id: 'N4', label: 'N4 Palier', test: "reactorPalierIn", color: "#0072BC"},
            { id: 'EPR',  label: 'EPR (Gen III)',  test: 'reactorPalierIn' },
            { id: 'EPR2', label: 'EPR2 (Gen III+)', test: 'reactorPalierIn' },
            {id: 'Other', label: 'Other',test: () => true},
        ],
        // optional pretty label
        groupLabel: (bin) => bin.label,
    },

    // 3) SERIES: StatusId → stacks, with label/color maps
    series: {
        id: 'statusIn',
        keyProp: (b) => String(b?.StatusId ?? 'unknown'),
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
                "1": "Not started",
                "2": "In Progress",
                "3": "Completed",
                "4": "At risk",
                "5": "Permanent Shutdown",
                "unknown": "Unknown",
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
                statusKey === 'unknown' ? null : ({ fn: 'statusIn', args: { values: [statusKey] } }),
            group:  (id, ctx) => ({ fn: 'reactorPalierIn', args: { values: [ctx.bin.id] } }),
        },
    },
};

const ec1_ChartCfg =  {
    // 1) where items come from
    title: "Top 5 EC Status per Facility",
    itemType: "ec",
    itemsOf: (data /* context.data */) => {
        const sites = Array.isArray(data?.site) ? data.site : [];
        const top5 = sites
            .map(item => ({
                ...item,
                openECs: (item?.ecsByStatus?.REGISTERED?._total || 0) + (item?.ecsByStatus?.APPROVED?._total || 0),
                id: item.name
            }))
            .sort((a, b) => b.openECs - a.openECs) // descending order
            .slice(0, 5);
        const ecs = top5.flatMap(s=>{
            const hydratedEcs = [];
            for(const status in s.ecsByStatus){
                for(const n of new Array(s.ecsByStatus[status]._total)){
                    hydratedEcs.push({
                        site: s,
                        status,
                        facility: s.siteId,
                        label: s.name
                    })
                }
            }
            return hydratedEcs;
        });

        return ecs;
        //TODO: alterantively call Platfrom go get full ECs data
    },

    // 2) GROUP
    group: {
        id: 'facilityIn',
        valueProp: (ec) => String(ec?.siteId ?? 'unknown'),
        getBins: (data, items) => {
            const sites = Array.isArray(data?.site) ? data.site : [];
            const top5 = sites
                .map(s => ({
                    ...s,
                    openECs: (s?.ecsByStatus?.REGISTERED?._total || 0) + (s?.ecsByStatus?.APPROVED?._total || 0),
                    id: s.siteId,
                    label: s.name,
                    test: "facilityIn"
                }))
                .sort((a, b) => b.openECs - a.openECs) // descending order
                .slice(0, 5);
            return top5;
        },
        // optional pretty label
        groupLabel: (bin) => bin.label,
    },

    // 3) SERIES: StatusId → stacks, with label/color maps
    series: {
        id: 'EC_statusIn',
        keyProp: (ecs) => String(ecs?.status ?? 'unknown'),
        config: {
            colorMap: {
                "REGISTERED": "#b8b8b8",
                "APPROVED": "#f4b740",
                "CLOSED": "#66bb6a",
            },
            labelMap: {
                "REGISTERED": "Registered",
                "APPROVED": "Approved",
                "CLOSED": "Closed",
            },
        },
        // keep a stable legend order
        order: (keys) => {
            const pref = ['REGISTERED','APPROVED','CLOSED']; // your desired sequence
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
                statusKey === 'unknown' ? null : ({ fn: 'EC_statusIn', args: { values: [statusKey] } }),
            group:  (id, ctx) => ({ fn: 'facilityIn', args: { values: [ctx.bin.id] } }),
        },
    },
};

export default function PortfolioDetails({ context, userConfig, send, stateKey, handler }) {

    const globalFilters = useSelector(getFilter)
    const dispatch = useDispatch();

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

                <DeployStatusChart
                    initialFilter={globalFilters["site"]}
                    handler={handler}
                    context={context}
                    send={send}
                    stateKey={stateKey}
                    chartCfg={ec1_ChartCfg}
                    onFilterChange={(filter) => {
                        const togglingOptions = {
                            replace: [ec1_ChartCfg.group.id, ec1_ChartCfg.series.id],// force toggle
                            dropMissing: [ec1_ChartCfg.group.id, ec1_ChartCfg.series.id],
                        }
                        const next = toggleScopedFilter(globalFilters, filter, "site", togglingOptions);
                        dispatch(setFilter(next));
                    }}
                />

            </Box>
        </div>
    );
}
