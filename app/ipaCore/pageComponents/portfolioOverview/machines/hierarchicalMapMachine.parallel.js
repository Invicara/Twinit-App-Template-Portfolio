// hierarchicalMapMachine.parallel.js — XState v5-compatible (REFRESHED)
// Parallel refactor: { boot || intent || lens || mode } regions
// - Renames `paths` -> `ontologyPaths` (clearer name)
// - Adds configurable `lens` region with async lensExitService/lensEntryService
// - Extends GO_TO to handle lens changes exactly like intent
// - Preserves initialize/entry/exit services and GO_TO semantics with confirmation barrier

import { assign, fromPromise, setup } from 'xstate';
import { getEntryAction, getInitAction, getExitAction } from './utils/scriptedEntryActions';
// NEW: dynamic lens actions (you implement these; same shape as scriptedEntryActions)
// export functions: getLensEntryAction, getLensExitAction

/**
 * Public API
 */
export const createParallelMapMachine = (
    MACHINE_ID = 'mapMachine',
    ontologyPaths, // formerly 'paths' — your ontology tree (array of arrays)
    lensConfig = [], // optional lenses (see example at bottom)
    machineSetup = {}
) => {
    const { actors, actions } = machineSetup;

    const machineDef = generateParallelMachine(MACHINE_ID, ontologyPaths, lensConfig);

    return setup({
        actors: actors || {
            initializeService: fromPromise(async ({ input }) => {
                return getInitAction(input);
            }),
            entryService: fromPromise(async ({ input }) => {
                const { context } = input;
                if (context.suppressEntryActions) return {};
                return getEntryAction(input);
            }),
            exitService: fromPromise(async ({ input }) => {
                const { context } = input;
                if (context.suppressExitActions) return {};
                return getExitAction(input);
            }),
            // NEW: lens services (async)
            lensEntryService: fromPromise(async ({ input }) => {
                const { context } = input;
                if (context.suppressLensEntry) return {};
                const mod = await import('./utils/scriptedLensActions');
                return mod.getLensEntryAction(input);
            }),
            lensExitService: fromPromise(async ({ input }) => {
                const { context } = input;
                if (context.suppressLensExit) return {};
                const mod = await import('./utils/scriptedLensActions');
                return mod.getLensExitAction(input);
            })
        },
        actions
    }).createMachine(machineDef);
};

/** Utility helpers (kept from your original) */
function toStateKey(segments) {
    return segments.map((s) => (typeof s === 'string' ? s : s.state)).join('.');
}
function normalizeSeg(s) {
    return typeof s === 'string' ? { state: s, idKey: s + 'Id' } : s;
}
function expandPaths(paths) {
    const all = new Set();
    const expanded = [];
    for (const path of paths) {
        for (let i = 1; i <= path.length; i++) {
            const segment = path.slice(0, i);
            const key = toStateKey(segment);
            if (!all.has(key)) {
                all.add(key);
                expanded.push(segment);
            }
        }
    }
    return expanded;
}
function collectAllIdKeys(paths) {
    return Array.from(
        new Set(
            paths
                .flat()
                .map((s) => (typeof s === 'string' ? s + 'Id' : s.idKey))
                .filter(Boolean)
        )
    );
}
function updateContextForEvent(allIdKeys, context, event) {
    const newCtx = {};
    for (const key of allIdKeys) {
        if (Object.prototype.hasOwnProperty.call(event, key)) newCtx[key] = event[key];
        else newCtx[key] = undefined;
    }
    return newCtx;
}

/**
 * Build transition table used by the global confirm/exit barrier to route to the correct ontology node
 */
function buildOntologyTransitions(MACHINE_ID, paths, { usePending = false } = {}) {
    const normalize = (p) => normalizeSeg(p);
    const normalizedPaths = paths.map((path) => path.map(normalize));

    const getEvt = ({ context, event }) => (usePending ? context.pendingEvent || {} : event);

    const hasAllIds = (fullPath, evt) => fullPath.every((p) => !p.idKey || (evt.hasOwnProperty(p.idKey) && evt[p.idKey] != null));
    const anyIdChanged = (fullPath, ctx, evt) => fullPath.some((p) => p.idKey && ctx[p.idKey] !== evt[p.idKey]);
    const allIdsSame = (fullPath, ctx, evt) => fullPath.every((p) => !p.idKey || ctx[p.idKey] === evt[p.idKey]);

    const deeperKeysAfter = (fullPath) => {
        const depth = fullPath.length;
        const anyPath = normalizedPaths.find((p) => p.length >= depth) || [];
        return anyPath.slice(depth).map((seg) => seg.idKey).filter(Boolean);
    };

    return normalizedPaths
        .reverse()
        .flatMap((path) => {
            const fullPath = path.map((p) => normalizeSeg(p));
            const target = `#${MACHINE_ID}.intent.${fullPath.map((p) => p.state).join('.')}`;
            const deeperKeys = deeperKeysAfter(fullPath);

            // 1) Upward bubbling by nulling deeper ids
            const upward = {
                target,
                reenter: true,
                guard: (args) => {
                    const evt = getEvt(args);
                    if (!hasAllIds(fullPath, evt)) return false;
                    const anyDeeperCleared = deeperKeys.some((k) => evt.hasOwnProperty(k) && evt[k] === null);
                    return anyDeeperCleared;
                },
                actions: assign((args) => {
                    const evt = getEvt(args);
                    return {
                        ...updateContextForEvent(collectAllIdKeys(paths), args.context, evt),
                        pendingEvent: null,
                        suppressEntryActions: false
                    };
                })
            };

            // 2) Reenter when ids changed
            const reentering = {
                target,
                reenter: true,
                guard: (args) => {
                    const evt = getEvt(args);
                    return hasAllIds(fullPath, evt) && anyIdChanged(fullPath, args.context, evt);
                },
                actions: assign((args) => {
                    const evt = getEvt(args);
                    return {
                        ...updateContextForEvent(collectAllIdKeys(paths), args.context, evt),
                        pendingEvent: null,
                        suppressEntryActions: false
                    };
                })
            };

            // 3) No-op (stay put but propagate ids)
            const noop = {
                target,
                reenter: false,
                guard: (args) => {
                    const evt = getEvt(args);
                    return hasAllIds(fullPath, evt) && allIdsSame(fullPath, args.context, evt);
                },
                actions: assign((args) => {
                    const evt = getEvt(args);
                    return {
                        ...updateContextForEvent(collectAllIdKeys(paths), args.context, evt),
                        pendingEvent: null,
                        suppressEntryActions: true
                    };
                })
            };

            return [upward, reentering, noop];
        });
}

/**
 * Build the ontology (intent) region from the path definitions
 */
function buildIntentStates(MACHINE_ID, paths, pathSegments, fullPath = []) {
    if (!pathSegments.length) return {};

    const [currentRaw, ...rest] = pathSegments;
    const current = normalizeSeg(currentRaw);
    const currentPath = [...fullPath, current];
    const stateKey = toStateKey(currentPath);

    const childState = buildIntentStates(MACHINE_ID, paths, rest, currentPath);

    // Each ontology node still runs entryService on (re)entry (initial or after GO_TO)
    const stateObj = {
        invoke: {
            src: 'entryService',
            id: `entryService:${stateKey}`,
            input: ({ context, event, self }) => ({ stateValue: stateKey, context, event, self, sendBack: self.send }),
            onDone: { actions: assign(({ event }) => event.output || {}) }
        },
        states: {
            ...childState
        }
    };

    return { [current.state]: stateObj };
}

/**
 * Top-level boot region mirrors original awaitingReady/initialize flow
 */
function buildBootRegion(MACHINE_ID) {
    return {
        initial: 'decide',
        states: {
            decide: {
                always: [
                    { guard: ({ context }) => !!context.map, target: 'ready' },
                    { target: 'awaitingReady' }
                ]
            },
            awaitingReady: {
                on: {
                    MAP_READY: {
                        target: 'initialize',
                        actions: assign(({ event }) => ({ map: event.map, mmvSend: event.mmvSend, setPopupState: event.setPopupState }))
                    }
                }
            },
            initialize: {
                invoke: {
                    src: 'initializeService',
                    input: ({ context, event, self }) => ({ context, event, self, sendBack: self.send }),
                    onDone: { target: 'ready', actions: assign(({ event }) => event.output || {}) },
                    onError: {
                        target: '#'+MACHINE_ID+'.error',
                        actions: assign(({ event }) => ({ error: event.error?.message || 'Failed to load layers' }))
                    }
                }
            },
            ready: {}
        }
    };
}

/**
 * Global mode region — idle → confirmExit → exiting (+ editing)
 * - Editing does NOT require confirm to exit.
 * - Also coordinates lens switching (lensExit → lensEntry) without touching intent.
 */
function buildModeRegion(MACHINE_ID, ontologyPaths, lensConfig = []) {
    const transitions = buildOntologyTransitions(MACHINE_ID, expandPaths(ontologyPaths), { usePending: true });

    return {
        initial: 'idle',
        states: {
            idle: {
                on: {
                    START_EDIT: 'editing',
                    // GO_TO can carry intent ids and/or a lens change
                    GO_TO: [
                        // 1) Lens-only change: run lens exit/entry
                        {
                            guard: ({ event }) => !!event.lens && !hasAnyIntentIds(event, ontologyPaths),
                            target: lensConfig.length ? 'lensSwitching' : undefined,
                            actions: assign(({ event }) => ({ pendingLens: event.lens }))
                        },
                        // 2) Intent (and maybe lens) change: confirm barrier
                        {
                            target: 'confirmExit',
                            actions: assign(({ event }) => ({ pendingEvent: event }))
                        }
                    ]
                }
            },

            editing: {
                on: {
                    END_DRAFT: 'idle',
                    GO_TO: [
                        // Lens-only change during editing
                        {
                            guard: ({ event }) => !!event.lens && !hasAnyIntentIds(event, ontologyPaths),
                            target: lensConfig.length ? 'lensSwitching' : undefined,
                            actions: assign(({ event }) => ({ pendingLens: event.lens }))
                        },
                        // Intent change applies immediately (no confirm)
                        {
                            target: 'exiting',
                            actions: assign(({ event }) => ({ pendingEvent: event }))
                        }
                    ]
                }
            },

            confirmExit: {
                // if you want a modal, remove this auto-confirm
                entry: ({ self }) => self.send({ type: 'CONFIRM_YES' }),
                on: {
                    CONFIRM_YES: 'exiting',
                    CONFIRM_NO: {
                        target: 'idle',
                        actions: assign(() => ({ pendingEvent: null, suppressEntryActions: true }))
                    }
                }
            },

            exiting: {
                invoke: {
                    id: 'exitService:global',
                    src: 'exitService',
                    input: ({ context, event, self }) => {
                        const snapshot = self.getSnapshot();
                        const stateValue = typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value.intent || {})[0];
                        return { stateValue, context, event, self, sendBack: self.send };
                    }
                },
                on: {
                    'xstate.done.actor.exitService:global': transitions.map((t) => ({
                        ...t,
                        actions: [
                            ...(Array.isArray(t.actions) ? t.actions : [t.actions]),
                            assign(() => ({ suppressEntryActions: false })),
                            assign(({ event }) => event.output || {}),
                            assign(() => ({ pendingEvent: null })),
                            // If GO_TO also requested a lens change, do lens switch next
                            ({ context, self }) => {
                                if (context.pendingEvent?.lens && lensConfig.length) {
                                    self.send({ type: 'MODE.LENS_SWITCH_AFTER_INTENT' });
                                }
                            },
                            // Notify lens region to ensure compatibility fallback after intent change
                            ({ self }) => self.send({ type: 'INTENT.LANDED' })
                        ]
                    }))
                }
            },

            // Lens switch flow (blocks clicks & sequences async exit->apply->entry)
            lensSwitching: lensConfig.length
                ? {
                    invoke: {
                        id: 'lensExitService',
                        src: 'lensExitService',
                        input: ({ context, self }) => ({
                            context,
                            currentLens: context.currentLens,
                            nextLens: context.pendingLens ?? context.pendingEvent?.lens,
                            self,
                            sendBack: self.send
                        })
                    },
                    on: {
                        'xstate.done.actor.lensExitService': {
                            actions: [
                                ({ self, context }) => {
                                    const next = context.pendingLens ?? context.pendingEvent?.lens;
                                    self.send({ type: 'LENS.APPLY', to: next });
                                }
                            ],
                            target: 'lensEntering'
                        }
                    }
                }
                : {},

            lensEntering: lensConfig.length
                ? {
                    invoke: {
                        id: 'lensEntryService',
                        src: 'lensEntryService',
                        input: ({ context, self }) => ({
                            context,
                            currentLens: context.currentLens,
                            nextLens: context.pendingLens ?? context.pendingEvent?.lens,
                            self,
                            sendBack: self.send
                        })
                    },
                    on: {
                        'xstate.done.actor.lensEntryService': {
                            target: 'idle',
                            actions: assign(() => ({ pendingLens: null }))
                        }
                    }
                }
                : {}
        }
    };
}

// Helpers
function hasAnyIntentIds(event, ontologyPaths) {
    const keys = collectAllIdKeys(ontologyPaths);
    return keys.some((k) => Object.prototype.hasOwnProperty.call(event, k));
}

/**
 * Lens region builder
 * lensConfig example:
 * [
 *   { state: 'utilization', appliesTo: ['portfolio','site','building','modelElement'] },
 *   { state: 'fuel',        appliesTo: ['site','building'] },
 *   { state: 'health',      appliesTo: ['building','modelElement'] }
 * ]
 */
function buildLensRegion(MACHINE_ID, ontologyPaths, lensConfig) {
    const states = Object.fromEntries(lensConfig.map((l) => [l.state, {}]));

    const allowedByIntent = lensConfig.reduce((acc, l) => {
        for (const intent of l.appliesTo || []) {
            acc[intent] = acc[intent] || new Set();
            acc[intent].add(l.state);
        }
        return acc;
    }, {});

    const defaultLensPerIntent = Object.fromEntries(
        Object.keys(allowedByIntent).map((k) => [k, Array.from(allowedByIntent[k])[0]])
    );

    return {
        initial: lensConfig[0]?.state,
        states,
        on: {
            'LENS.APPLY': [
                // Only allow if the current intent supports it
                {
                    guard: ({ context }, e) => {
                        const kind = context._lastIntentKind;
                        return !kind || allowedByIntent[kind]?.has?.(e.to);
                    },
                    target: (args) => `.\${args.event.to}`,
                    actions: assign(({ event }) => ({ currentLens: event.to }))
                }
            ],
            // Ensure we have a valid lens after intent changes
            'LENS.FALLBACK_FOR_INTENT': {
                actions: assign(({ context }) => {
                    const kind = context._lastIntentKind;
                    const fallback = kind ? defaultLensPerIntent[kind] : undefined;
                    return fallback ? { currentLens: fallback } : {};
                })
            }
        }
    };
}

/**
 * Build the full parallel machine
 */
function generateParallelMachine(MACHINE_ID, ontologyPaths, lensConfig) {
    const allIdKeys = collectAllIdKeys(ontologyPaths);
    const firstTop = typeof ontologyPaths[0][0] === 'string' ? ontologyPaths[0][0] : ontologyPaths[0][0].state;

    const intentStates = ontologyPaths.reduce((acc, path) => {
        const [topRaw, ...rest] = path;
        const top = typeof topRaw === 'string' ? { state: topRaw, idKey: null } : { ...topRaw, idKey: null };
        acc[top.state] = {
            states: {
                ...buildIntentStates(MACHINE_ID, ontologyPaths, rest, [top])
            }
        };
        return acc;
    }, {});

    return {
        id: MACHINE_ID,
        type: 'parallel',
        context: {
            namedPaths: ontologyPaths,
            pendingEvent: null,
            pendingLens: null,
            suppressEntryActions: false,
            suppressExitActions: false,
            suppressLensEntry: false,
            suppressLensExit: false,
            manageMarkers: {},
            currentLens: lensConfig[0]?.state,
            // id slots populated by GO_TO
            ...allIdKeys.reduce((o, k) => ((o[k] = undefined), o), {}),
            // Keep last known intent kind for lens guards
            _lastIntentKind: firstTop,
            _lastSnapshot: null
        },
        entry: [({ self, context }) => {
            // track snapshots to update _lastIntentKind
            self.onTransition((s) => {
                const intent = s.value?.intent;
                if (intent) {
                    const keys = Object.keys(intent);
                    if (keys.length) context._lastIntentKind = keys[0];
                }
                context._lastSnapshot = s;
            });
        }],
        states: {
            // 1) Boot
            boot: buildBootRegion(MACHINE_ID),

            // 2) Intent region
            intent: {
                initial: firstTop,
                states: intentStates
            },

            // 3) Lens region (optional)
            ...(lensConfig && lensConfig.length
                ? { lens: buildLensRegion(MACHINE_ID, ontologyPaths, lensConfig) }
                : {}),

            // 4) Mode region
            mode: buildModeRegion(MACHINE_ID, ontologyPaths, lensConfig)
        },

        on: {
            GO_TO: {
                actions: assign(({ event, context }) => ({
                    pendingEvent: event,
                    pendingLens: event.lens ?? null,
                    ...updateContextForEvent(collectAllIdKeys(ontologyPaths), context, event)
                }))
            },
            UPDATE_DATA: {
                actions: assign(({ event }) => ({ data: event.data }))
            },
            // On intent landing, enforce lens compatibility if needed
            'INTENT.LANDED': ({ context, self }) => {
                if (lensConfig?.length) self.send({ type: 'LENS.FALLBACK_FOR_INTENT' });
            }
        }
    };
}

/**
 * Example configs
 *
 * const ONTOLOGY_PATHS = [
 *   [
 *     { state: 'portfolio', idKey: null },
 *     { state: 'site', idKey: 'siteId', feature: 'polygon', api: 'site/all' },
 *     { state: 'building', idKey: 'buildingId', feature: 'point', api: 'building/all' },
 *     { state: 'modelElement', idKey: 'modelElementId' }
 *   ]
 * ];
 *
 * const LENS_CONFIG = [
 *   { state: 'utilization', appliesTo: ['portfolio','site','building','modelElement'] },
 *   { state: 'fuel',        appliesTo: ['site','building'] },
 *   { state: 'health',      appliesTo: ['building','modelElement'] }
 * ];
 *
 * createParallelMapMachine('map', ONTOLOGY_PATHS, LENS_CONFIG)
 */
