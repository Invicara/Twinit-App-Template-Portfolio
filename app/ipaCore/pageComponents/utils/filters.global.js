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
const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const deepClone = (x) => JSON.parse(JSON.stringify(x ?? {}));
const sameSet = (a, b) => {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    for (const v of b) if (!s.has(v)) return false;
    return true;
};
/**
 * Group Toggle (only toggle off when the whole clicked filter matches) + merge for one scope
 * - If replace applies to a rule and clicked values equal existing values → TOGGLE OFF (remove rule)
 * - Else if replace applies → overwrite rule
 * - Else (no replace) → toggle union/remove per values
 */
export function toggleScopedFilter(
    currentFilter,
    incomingFilter,
    scope = "site",
    {
        replace,                 // boolean | string[] | (fnName)=>boolean
        dropMissing,             // boolean | string[] | (fnName)=>boolean
        deleteMarker = "__delete",
        preserveEmptyScope = true,
    } = {}
) {
    // normalize incoming to scoped form
    const incomingScoped =
        incomingFilter && !("op" in incomingFilter)
            ? incomingFilter
            : { [scope]: incomingFilter };

    const incomingNode = toAndNode(incomingScoped?.[scope]);
    if (!incomingNode.rules.length) {
        const curr = deepClone(currentFilter);
        return preserveEmptyScope && !curr[scope] ? { [scope]: {} } : curr;
    }

    // clone current; get scope node
    const next = deepClone(currentFilter);
    const scopeNode = toAndNode(next?.[scope]);
    scopeNode.op = scopeNode.op || incomingNode.op || "and";

    // index current rules by fn
    const byFn = new Map();
    for (const r of scopeNode.rules) if (isRule(r)) byFn.set(r.fn, r);

    // collect incoming rule info
    const incomingRules = incomingNode.rules.filter(isRule);
    const incomingFns = new Set(incomingRules.map(r => r.fn));

    // ----- GROUP-LEVEL TOGGLE CHECK (for replace-target rules) -----
    const replaceTargets = incomingRules.filter(r => shouldReplace(r.fn, replace));

    let allReplaceTargetsMatch = replaceTargets.length > 0
        && replaceTargets.every(r => {
            const ex = byFn.get(r.fn);
            if (!ex) return false;
            const exVals = asArray(ex.args?.values);
            const inVals = asArray(r.args?.values);
            return sameSet(exVals, inVals);
        });

    if (allReplaceTargetsMatch) {
        // toggle OFF all replace-target rules as a group
        scopeNode.rules = scopeNode.rules.filter(r => !(isRule(r) && incomingFns.has(r.fn)));
        // (optionally: also handle non-replace rules in incoming; here we remove only the replace targets)
    } else {
        // ----- APPLY RULES -----
        for (const inc of incomingNode.rules) {
            if (!isRule(inc)) { scopeNode.rules.push(inc); continue; }

            // explicit delete?
            if (inc.args && inc.args[deleteMarker]) {
                scopeNode.rules = scopeNode.rules.filter(r => !(isRule(r) && r.fn === inc.fn));
                byFn.delete(inc.fn);
                continue;
            }

            const existing = byFn.get(inc.fn);
            const clickedValues = asArray(inc.args?.values).map(String);
            const doReplace = shouldReplace(inc.fn, replace);

            if (doReplace) {
                if (existing) {
                    const i = scopeNode.rules.findIndex(r => isRule(r) && r.fn === inc.fn);
                    scopeNode.rules[i] = inc;
                    byFn.set(inc.fn, inc);
                } else {
                    scopeNode.rules.push(inc);
                    byFn.set(inc.fn, inc);
                }
            } else {
                // standard toggle (union/remove)
                if (!existing) {
                    scopeNode.rules.push(inc);
                    byFn.set(inc.fn, inc);
                } else {
                    const currentValues = asArray(existing.args?.values).map(String);
                    const allAlready = clickedValues.every(v => currentValues.includes(v));
                    if (allAlready) {
                        // remove clicked values
                        const remaining = currentValues.filter(v => !clickedValues.includes(v));
                        if (remaining.length) {
                            existing.args = { ...(existing.args || {}), values: remaining };
                        } else {
                            scopeNode.rules = scopeNode.rules.filter(r => !(isRule(r) && r.fn === inc.fn));
                            byFn.delete(inc.fn);
                        }
                    } else {
                        // add missing values (union)
                        const merged = Array.from(new Set([...currentValues, ...clickedValues]));
                        existing.args = { ...(existing.args || {}), values: merged };
                    }
                }
            }
        }
    }

    // dropMissing (optional): remove rules not present in incoming (by fn)
    if (dropMissing) {
        scopeNode.rules = scopeNode.rules.filter(r => {
            if (!isRule(r)) return true;
            return !(shouldDropMissing(r.fn, dropMissing) && !incomingFns.has(r.fn));
        });
    }

    // return with/without empty scope
    if (!scopeNode.rules.length) {
        return preserveEmptyScope
            ? { ...next, [scope]: {} }
            : (() => { const c = { ...next }; delete c[scope]; return Object.keys(c).length ? c : {}; })();
    }
    return { ...next, [scope]: scopeNode };
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
            return () => true;
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
        console.warn("Invalid filter node", node);
        return () => true;
    }
}
