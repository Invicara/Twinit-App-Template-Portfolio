// generateMapMachine.js (XState v5 compatible)
import {assign, fromPromise, setup, spawnChild} from 'xstate';
import {getEntryAction, getInitAction, getExitAction} from './utils/scriptedEntryActions';

export function generateMapMachine(MACHINE_ID= 'mapMachine', paths, services) {

    const toStateKey = (segments) => segments.map(s => typeof s === 'string' ? s : s.state).join('.');
    const toStatePath = (segments) => `#${MACHINE_ID}.${segments.map(s => typeof s === 'string' ? s : s.state).join('.')}`;

    const allIdKeys = Array.from(
        new Set(paths.flat().map(s => (typeof s === 'string' ? s + 'Id' : s.idKey)).filter(Boolean))
    );

    function updateContextForEvent(context, event) {
        const newCtx = {};
        for (const key of allIdKeys) {
            if (event.hasOwnProperty(key)) {
                newCtx[key] = event[key];
            } else {
                newCtx[key] = undefined;
            }
        }
        return newCtx;
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

    function buildTransitions(pathList, { usePending = false } = {}) {
        const normalize = (p) =>
            typeof p === 'string' ? { state: p, idKey: p + 'Id' } : p;
        const normalizedPaths = pathList.map(path => path.map(normalize));

        // helper to pick correct event source
        const getEvt = ({ context, event }) =>
            usePending ? (context.pendingEvent || {}) : event;

        // check all required ids present for the path
        const hasAllIds = (fullPath, evt) =>
            fullPath.every(p => !p.idKey || (evt.hasOwnProperty(p.idKey) && evt[p.idKey] != null));


        // did any id differ vs context?
        const anyIdChanged = (fullPath, ctx, evt) =>
            fullPath.some(p => p.idKey && ctx[p.idKey] !== evt[p.idKey]);

        // did all ids match vs context?
        const allIdsSame = (fullPath, ctx, evt) =>
            fullPath.every(p => !p.idKey || ctx[p.idKey] === evt[p.idKey]);

        const deeperKeysAfter = (fullPath) => {
            const depth = fullPath.length;
            const anyPath = normalizedPaths.find(p => p.length >= depth) || [];
            return anyPath.slice(depth).map(seg => seg.idKey).filter(Boolean);
        };

        return normalizedPaths.reverse().flatMap(path => {
            const fullPath = path.map(p => typeof p === 'string' ? { state: p, idKey: p + 'Id' } : p);
            const target = `#${MACHINE_ID}.${fullPath.map(p => p.state).join('.')}`;
            const deeperKeys = deeperKeysAfter(fullPath);

            // 1) Upward bubbling: any deeper idKey is explicitly null → jump to this level
            const upward = {
                target,
                reenter: true,
                guard: (args) => {
                    const evt = getEvt(args);
                    if (!hasAllIds(fullPath, evt)) {
                        //console.log("machine upward guard1", {guard: false, target, fullPath, evt});
                        return false;
                    } // let reentering handle that
                    // if ANY deeper key is present and null → this is an upward request
                    const anyDeeperCleared = deeperKeys.some(k => evt.hasOwnProperty(k) && evt[k] === null);
                    //console.log("machine upward guard2", {guard: anyDeeperCleared, target, fullPath, evt});
                    return anyDeeperCleared;
                },
                actions: assign((args) => {
                    const evt = getEvt(args);
                    return {
                        ...updateContextForEvent(args.context, evt),
                        pendingEvent: null,
                        suppressEntryActions: false
                    };
                })
            };

            // 2) Reentering transition when IDs changed (and present)
            const reentering = {
                target,
                reenter: true,
                guard: args => {
                    const evt = getEvt(args);
                    const guard =  hasAllIds(fullPath, evt) && anyIdChanged(fullPath, args.context, evt);
                    //console.log("machine reentering guard", {guard, target, fullPath, evt});
                    return guard;
                },
                actions: assign(args => {
                    const evt = getEvt(args);
                    return {
                        ...updateContextForEvent(args.context, evt),
                        pendingEvent: null,
                        suppressEntryActions: false
                    };
                })
            };

            // 3) No-op: all ids same at this level AND no upward request
            const noop = {
                target,
                reenter: false,
                guard: args => {
                    const evt = getEvt(args);
                    const guard =  hasAllIds(fullPath, evt) && !anyIdChanged(fullPath, args.context, evt);
                    //console.log("machine noop guard", {guard, target, fullPath, evt});
                    return guard;
                },
                actions: assign(args => {
                    const evt = getEvt(args);
                    return {
                        ...updateContextForEvent(args.context, evt),
                        pendingEvent: null,
                        suppressEntryActions: true
                    };
                })
            };

            //this has to be done as reenter option is not a function, and cannot check against context or event
            return [upward, reentering, noop];
        });
    }

    function buildStates(pathSegments, fullPath = []) {
        if (!pathSegments.length) return {};

        const [currentRaw, ...rest] = pathSegments;
        const current = typeof currentRaw === 'string' ? { state: currentRaw, idKey: currentRaw + 'Id' } : currentRaw;
        const currentPath = [...fullPath, current];
        const stateKey = toStateKey(currentPath);

        const childState = buildStates(rest, currentPath);
        const transitions = buildTransitions(expandPaths(paths), {usePending: true});

        const stateObj = {
            initial: 'idle',
            invoke: {
                src: "entryService",
                id: "entryService", // stable id so we can handle its done event
                input: ({ context, event, self }) => {
                    return { stateValue: stateKey, context, event, self, sendBack: self.send }
                },
                onDone: {
                    actions: assign(({ event }) => {
                        //console.log("entryService output", event)
                        return event.output || {}
                    })
                },
            },
            states: {
                idle: {
                    on: {
                        GO_TO: {
                            target: 'confirmExit',
                            reenter: true,
                            actions: assign(({ event }) => ({ pendingEvent: event }))
                        }
                    }
                },
                confirmExit: {
                    entry: ({ event, self, context }) => {
                        //console.log("machine confirmExit", {self, event, context});
                        return self.send({ type: 'CONFIRM_YES' });
                    },
                    on: {
                        CONFIRM_YES: "exiting",
                        CONFIRM_NO: {
                            target: `idle`,
                            actions: assign(() => ({
                                pendingEvent: null,
                                suppressEntryActions: true
                            }))
                        }
                    }
                },
                exiting: {
                    invoke: {
                        id: "exitService",
                        src: "exitService",
                        input: ({ context, event, self }) => {
                            const snapshot = self.getSnapshot();
                            const stateValue = typeof snapshot.value === 'string'
                                ? snapshot.value
                                : Object.keys(snapshot.value)[0]; // for top-level compound states
                            return { stateValue, context, event, self, sendBack: self.send }
                        },
                    },
                    on: {
                        "xstate.done.actor.exitService": transitions.map(t => ({ ...t, actions: [
                                ...(Array.isArray(t.actions) ? t.actions : [t.actions]),
                                assign(() => ({
                                    pendingEvent: null,
                                    suppressEntryActions: false
                                }))
                        ]}))
                    }
                },
                ...childState
            }
        };

        return {
            [current.state]: stateObj
        };
    }

    const topLevelStates = paths.reduce((acc, path) => {
        const [topRaw, ...rest] = path;
        const top = typeof topRaw === 'string' ? { state: topRaw, idKey: null } : { ...topRaw, idKey: null };
        acc[top.state] = acc[top.state] || { initial: 'decide', states: {} };

        Object.assign(acc[top.state].states, {
            decide: {
                always: [
                    {
                        guard: ({ context }) => context.map,
                        target: 'idle'
                    },
                    {
                        target: 'awaitingReady'
                    }
                ]
            },
            awaitingReady: {
                on: {
                    MAP_READY: {
                        target: 'initialize',
                        actions: assign(({ event }) => ({ map: event.map, mmvSend: event.mmvSend }))
                    }
                }
            },
            initialize: {
                invoke: {
                    src: services?.initializeService || 'initializeService',
                    input: ({ context, event, self }) => ({ context, event, self, sendBack: self.send }),
                    onDone: {
                        target: `idle`,
                        actions: assign(({ event }) => {return event.output || {}})
                    },
                    onError: {
                        target: `#${MACHINE_ID}.error`,
                        actions: assign(({ event }) => {
                            console.log("Error", event);
                            return {
                                error: event.error?.message || 'Failed to load layers'
                            };
                        })
                    }
                }
            },
            idle: {
                invoke: {
                    src: "entryService",
                    id: "entryService", // stable id so we can handle its done event
                    input: ({ context, event, self }) => {
                        const snapshot = self.getSnapshot();
                        const stateValue = typeof snapshot.value === 'string'
                            ? snapshot.value
                            : Object.keys(snapshot.value)[0]; // for top-level compound states
                        return { stateValue, context, event, self, sendBack: self.send }
                    },
                    onDone: {
                        actions: assign(({ event }) => {
                            //console.log("entryService output", event)
                            return event.output || {}
                        })
                    },
                },
                on: {
                    GO_TO: {
                        target: 'confirmExit',
                        reenter: true,
                        actions: assign(({ event }) => ({ pendingEvent: event }))
                    }
                }
            },
            confirmExit: {
                entry: ({ self }) => {return self.send({ type: 'CONFIRM_YES' })},
                //entry: ({ self }) => self.send({ type: 'CONFIRM_YES' }),
                on: {
                    CONFIRM_YES: 'exiting',
                    CONFIRM_NO: {
                        target: `idle`,
                        actions: assign(() => ({
                            pendingEvent: null,
                            suppressEntryActions: true
                        }))
                    }
                }
            },
            exiting: {
                invoke: {
                    id: "exitService",
                    src: "exitService",
                    input: ({ context, event, self }) => {
                        const snapshot = self.getSnapshot();
                        const stateValue = typeof snapshot.value === 'string'
                            ? snapshot.value
                            : Object.keys(snapshot.value)[0]; // for top-level compound states
                        return { stateValue, context, event, self, sendBack: self.send }
                    },
                },
                on: {
                    "xstate.done.actor.exitService": buildTransitions(expandPaths(paths), {usePending: true}).map(t => ({
                        ...t,
                        actions: [
                            ...(Array.isArray(t.actions) ? t.actions : [t.actions]),
                            assign(() => ({
                                pendingEvent: null,
                                suppressEntryActions: false
                            }))
                        ]
                    }))
                }
            },
            ...buildStates(rest, [top])
        });
        return acc;
    }, {});

    return {
        id: MACHINE_ID,
        initial: typeof paths[0][0] === 'string' ? paths[0][0] : paths[0][0].state,
        context: {
            namedPaths: paths,
            pendingEvent: null,
            suppressEntryActions: false
        },
        states: {
            ...topLevelStates,
            error: {
                type: 'final',
                entry: assign({
                    error: ({ event }) => event.error || 'Unknown error'
                })
            }
        },
        on: {
            '*': { actions: [({context, event}) => {
                //console.log('[machine event]', event)
            }] },
            GO_TO: {
                actions: assign(({ event }) => ({ pendingEvent: event }))
            },
            UPDATE_DATA: {
                actions: assign(({ event }) => ({ 
                    data: event.data 
                }))
            }
        }
    };
}

export const createMachine = (id = 'mapMachine', paths, machineSetup = {}) => {
    const {actors, actions} = machineSetup;
    const machineDef = generateMapMachine(id, paths, {
        initializeService: 'initializeService',
        entryService: 'entryService',
        exitService: 'exitService'
    });
    return setup({
        actors: actors || {
            initializeService: fromPromise(async ({ input }) => {
                const {context, sendBack} = input;
                return getInitAction(input);
            }),
            entryService: fromPromise(async ({input}) => {
                //console.log(`Entry Args`, {input});
                const {context, event, self, stateValue} = input;
                if (context.suppressEntryActions) return {};
                return getEntryAction({ stateValue, context, event, self });
            }),
            exitService: fromPromise(async ({ input }) => {
                //console.log(`Exit Args`, {input});
                const {context, event, self, stateValue} = input;
                if (context.suppressEntryActions) return {};
                return getExitAction({ stateValue, context, event, self });
            })
        }
    }).createMachine(machineDef);
};
