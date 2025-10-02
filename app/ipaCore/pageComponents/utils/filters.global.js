import {IafScriptEngine} from "@dtplatform/iaf-script-engine";

export function getGlobalFilterFunctions(entityType, isMapFeatures = false) {
    const fnsFactory = IafScriptEngine.getVar("loadedScripts")["filterRuleFns"];
    const originalFns = fnsFactory({entityType, isMapFeatures});
    const fns = {
        ...originalFns,
        capacityBetween:
            ({min, max}) =>
                (e) => {
                    const entity = isMapFeatures ? e.properties : e;
                    //original one is about the building
                    const originalPredicate = originalFns.capacityBetween({min, max});
                    if (entityType == "site") {
                        return entity.buildings.some(originalPredicate);
                    } else {
                        return originalPredicate(entity);
                    }

                },
        statusIn: ({values}) => (e) => {
            const entity = isMapFeatures ? e.properties : e;
            //original one is about the building
            const originalPredicate = originalFns.statusIn({values});
            if (entityType == "site") {
                return entity.buildings.some(originalPredicate);
            } else {
                return originalPredicate(entity);
            }
        },
        EC_statusIn: ({values}) => (e) => {
            const entity = isMapFeatures ? e.properties : e;
            let ecsByStatus = {};
            if (entityType == "es") {
                ecsByStatus[entity.status] = 1;
            } else {
                ecsByStatus = entity.ecsByStatus;
            }
            const set = new Set(values.map(v => String(v).toUpperCase()));
            const statuses = new Set(Object.entries(ecsByStatus).filter(([k,v])=>v._total > 0).map(([k,v]) => String(k).toUpperCase()));
            return set.intersection(statuses).size>0;
        },
        reactorPalierIn:
            ({ values = [] }) =>
                (e) => {
                    // 1) Normalize wanted set (case-insensitive)
                    const wanted = new Set(values.map(v => String(v).toUpperCase()));

                    // 2) Extract ReactorModel strings for this entity (site or building or map feature)
                    const props = e && typeof e === 'object' ? (e.properties || e) : {};
                    const buildings = Array.isArray(props.buildings) ? props.buildings : null;

                    const models = buildings
                        ? buildings.map(b => String(b?.ReactorModel ?? '').toUpperCase()).filter(Boolean)
                        : [String((props?.ReactorModel ?? '')).toUpperCase()].filter(Boolean);

                    if (models.length === 0) {
                        // Treat missing model as OTHER only if specifically requested
                        return wanted.has('OTHER');
                    }

                    // 3) Palier patterns (precise & case-insensitive)
                    const isN4     = (m) => /\bN4\b/.test(m) || /\bN4\s+REP\s+1450\b/.test(m);
                    const isP4     = (m) => /\bP'?4\b/.test(m);                    // matches P4 or P'4, but not CP4
                    const isCPY    = (m) => /\bCP(?:0|1|2|Y)\b/.test(m);           // CP0/CP1/CP2/CPY → grouped as CPY
                    const isEPR2   = (m) => /\bEPR2\b/.test(m);
                    const isEPR    = (m) => /\bEPR\b/.test(m) && !isEPR2(m);       // plain EPR only

                    // 4) If OTHER requested, we need to know "named" categories
                    const matchesNamed = (m) => isN4(m) || isP4(m) || isCPY(m) || isEPR(m) || isEPR2(m);

                    // 5) Decide for each model
                    const modelMatches = (m) => {
                        if (wanted.has('N4')        && isN4(m))   return true;
                        if (wanted.has("P4/P'4")    && isP4(m))   return true;
                        if (wanted.has('CP0/CPY')   && isCPY(m))  return true;
                        if (wanted.has('EPR2')      && isEPR2(m)) return true;
                        if (wanted.has('EPR')       && isEPR(m))  return true;
                        if (wanted.has('OTHER')     && !matchesNamed(m)) return true;
                        return false;
                    };

                    // 6) Any model in the entity that matches → include
                    return models.some(modelMatches);
                }
        ,
        reactorModelIn:
            ({values = []}) => (e) => {
                const entity = isMapFeatures ? e.properties : e;
                let models;
                if (entityType == "site") {
                    models = new Set(entity.buildings.map(b=>String(b.ReactorModel).toUpperCase()));
                } else {
                    models = new Set([String(entity.ReactorModel).toUpperCase()]);
                }
                const set = new Set(values.map(v => String(v).toUpperCase()));
                return set.intersection(models).size>0;
            },
        facilityIn:
            ({values = []}) => (e) => {
                const entity = isMapFeatures ? e.properties : e;
                let facilityIds = [];
                if (entityType == "ec") {
                    facilityIds = new Set([entity.facility.toUpperCase()]);
                } else {
                    facilityIds = new Set([String(entity.siteId).toUpperCase()]);
                }
                const set = new Set(values.map(v => String(v).toUpperCase()));
                try {
                    const inter = set.intersection(facilityIds);
                    return inter.size;
                } catch (e) {
                    return false;
                }
            },
    }
    return fns;
}

/** Return true if thing looks like a logic node (has op) rather than a rule */
const isNode = (x) =>
x && typeof x === "object" && "op" in x;

/** Return true if thing looks like a rule leaf */
const isRule = (x) =>
    x && typeof x === "object" && typeof x.fn === "string";

/** Normalize a node to an AND node with a rules array (for easy merging) */
function toAndNode(n) {
    if (!n) return { op: "and", rules: [] };
    if (isRule(n)) return { op: "and", rules: [n] };
    if (n.op === "not") return { op: "and", rules: [n] };
    // keep incoming op if it's 'and' or 'or'
    if (!Array.isArray(n.rules)) return { op: "and", rules: [] };
    return n;
}

/** Merge args by unioning any array fields (esp. args.values); keep scalars from base if equal or identical */
function mergeArgs(base, inc) {
    const out = { ...base };
    const keys = new Set([...Object.keys(base), ...Object.keys(inc)]);
    keys.forEach(k => {
        const bv = base[k], iv = inc[k];
        if (Array.isArray(bv) && Array.isArray(iv)) {
            out[k] = Array.from(new Set([...bv, ...iv])); // union arrays (e.g., values)
        } else if (iv !== undefined) {
            out[k] = iv;
        } else {
            out[k] = bv;
        }
    });
    return out;
}
function shouldReplace(fnName, replace) {
    if (typeof replace === "undefined") return true;
    if (!replace) return false;
    if (replace === true) return true;
    if (Array.isArray(replace)) return replace.includes(fnName);
    if (typeof replace === "function") return !!replace(fnName);
    return false;
}
function shouldDropMissing(fnName, dropMissing) {
    if (!dropMissing) return false;
    if (dropMissing === true) return true;
    if (Array.isArray(dropMissing)) return dropMissing.includes(fnName);
    if (typeof dropMissing === "function") return !!dropMissing(fnName);
    return false;
}

/** Merge inc -> base at one logic level, with replace + dropMissing + deleteMarker support. */
function mergeNodes(
    baseNode,
    incNode,
    opts
) {
    const deleteKey = opts?.deleteMarker ?? "__delete";

    const base = toAndNode(baseNode);
    const inc = toAndNode(incNode);

    // collect which fns appear in incoming (for dropMissing)
    const incomingFns = new Set();
    inc.rules.forEach(r => { if (isRule(r)) incomingFns.add(r.fn); });

    const out = { op: base.op || "and", rules: [...base.rules] };

    // 1) Apply incoming (merge/replace or delete)
    for (const r of inc.rules) {
        if (isRule(r)) {
            // explicit delete?
            if (r.args && r.args[deleteKey]) {
                const idx = out.rules.findIndex(x => isRule(x) && (x).fn === r.fn);
                if (idx !== -1) out.rules.splice(idx, 1);
                continue;
            }
            // merge/replace existing or append
            const idx = out.rules.findIndex(x => isRule(x) && (x).fn === r.fn);
            if (idx === -1) {
                out.rules.push(r);
            } else {
                if (shouldReplace(r.fn, opts?.replace)) {
                    out.rules[idx] = r; // replace entire rule
                } else {
                    const existing = out.rules[idx];
                    out.rules[idx] = { fn: existing.fn, args: mergeArgs(existing.args, r.args) };
                }
            }
        } else {
            // nested nodes → append as-is
            out.rules.push(r);
        }
    }

    // 2) Drop-missing: for fns opted-in, if not present in incoming, remove them
    if (opts?.dropMissing) {
        out.rules = out.rules.filter((x) => {
            if (!isRule(x)) return true;
            const fn = (x).fn;
            // only drop if the fn matches the opt-in AND it's missing from incoming set
            return !(shouldDropMissing(fn, opts.dropMissing) && !incomingFns.has(fn));
        });
    }

    return out;
}

/** Merge two filters that may be scoped or bare nodes. */
export function mergeFiltersGeneric(
    globalFilter,
    incoming,
    scope = "global",
    options
) {
    const globalIsScoped = globalFilter && !("op" in (globalFilter));
    const incomingIsScoped = incoming && !("op" in (incoming));
    const out = globalIsScoped
        ? JSON.parse(JSON.stringify(globalFilter))
        : { [scope]: (globalFilter) || { op: "and", rules: [] } };

    if (incomingIsScoped) {
        for (const [sc, node] of Object.entries(incoming)) {
            const existing = out[sc] || { op: "and", rules: [] };
            out[sc] = mergeNodes(existing, node, options);
        }
    } else {
        const existing = out[scope] || { op: "and", rules: [] };
        out[scope] = mergeNodes(existing, incoming, options);
    }
    return out;
}


export class FilterCompiler {
    constructor(fns) {
        this.fns = fns
    }
    compileFilter(node) {
        if (!this.fns) {
            return true;
        }
        if ("fn" in node) {
            const factory = (this.fns)[node.fn];
            if (!factory) throw new Error(`Unknown filter fn: ${node.fn}`);
            return factory(node.args ?? {});
        }
        if (node.op === "not") {
            const inner = this.compileFilter(node.rule);
            return x => !inner(x);
        }
        if (node.op === "and") {
            const parts = node.rules.map(r => this.compileFilter(r));
            return x => parts.every(p => p(x));
        }
        if (node.op === "or") {
            const parts = node.rules.map(r => this.compileFilter(r));
            return x => parts.some(p => p(x));
        }
        // Exhaustiveness
        throw new Error("Invalid filter node");
    }
}
