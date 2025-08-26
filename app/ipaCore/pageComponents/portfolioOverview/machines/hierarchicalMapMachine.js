// generateMapMachine.js (XState v5 compatible)
import {assign, fromPromise, setup} from 'xstate';
import {getEntryAction, getInitAction} from './utils/scriptedEntryActions';

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

    function buildTransitions(pathList, usePendingEvent) {
        return pathList.reverse().map(path => {
            const fullPath = path.map(p => typeof p === 'string' ? { state: p, idKey: p + 'Id' } : p);
            return {
                target: `#${MACHINE_ID}.${fullPath.map(p => p.state).join('.')}`,
                guard: ({ context, event }) => {
                    const eventSource = usePendingEvent ? context.pendingEvent || event : event;
                    const guard = fullPath.every(p => {
                        if (!p.idKey) return true;
                        if (eventSource.hasOwnProperty(p.idKey)) {
                            return eventSource[p.idKey] != null;
                        }
                        return false;
                    });
                    console.log("guard", {guard, target: `#${MACHINE_ID}.${fullPath.map(p => p.state).join('.')}`}, fullPath, eventSource)
                    return guard;
                },
                reenter: ({ context, event }) => {
                    const eventSource = usePendingEvent ? context.pendingEvent || event : event;
                    return fullPath.some(p => p.idKey && context[p.idKey] !== eventSource[p.idKey]);
                },
                actions: assign(({ context, event }) => {
                    const eventSource = usePendingEvent ? context.pendingEvent || event : event;
                    return updateContextForEvent(context, eventSource);
                })
            };
        });
    }

    function buildStates(pathSegments, fullPath = []) {
        if (!pathSegments.length) return {};

        const [currentRaw, ...rest] = pathSegments;
        const current = typeof currentRaw === 'string' ? { state: currentRaw, idKey: currentRaw + 'Id' } : currentRaw;
        const currentPath = [...fullPath, current];
        const stateKey = toStateKey(currentPath);

        const childState = buildStates(rest, currentPath);
        const transitions = buildTransitions(expandPaths(paths), true);

        const stateObj = {
            initial: 'idle',
            entry: ({ context, event, self }) => {
                if (context.suppressEntryActions) return;
                return getEntryAction({ stateValue: stateKey, context, event, self });
            },
            states: {
                idle: {
                    on: {
                        GO_TO: {
                            target: 'confirmExit',
                            actions: assign(({ event }) => ({ pendingEvent: event }))
                        }
                    }
                },
                confirmExit: {
                    entry: ({ self }) => self.send({ type: 'CONFIRM_YES' }),
                    on: {
                        CONFIRM_YES: transitions.map(t => ({ ...t, actions: [
                                ...(Array.isArray(t.actions) ? t.actions : [t.actions]),
                                assign(() => ({
                                    pendingEvent: null,
                                    suppressEntryActions: false
                                }))
                            ] })),
                        CONFIRM_NO: {
                            target: `idle`,
                            actions: assign(() => ({
                                pendingEvent: null,
                                suppressEntryActions: true
                            }))
                        }
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
                entry: ({ context, event, self }) => {
                    if (context.suppressEntryActions) return;
                    const snapshot = self.getSnapshot();
                    const stateValue = typeof snapshot.value === 'string'
                        ? snapshot.value
                        : Object.keys(snapshot.value)[0]; // for top-level compound states
                    return getEntryAction({ stateValue, context, event, self });
                },
                on: {
                    GO_TO: {
                        target: 'confirmExit',
                        actions: assign(({ event }) => ({ pendingEvent: event }))
                    }
                }
            },
            confirmExit: {
                entry: ({ self }) => self.send({ type: 'CONFIRM_YES' }),
                on: {
                    CONFIRM_YES: buildTransitions(expandPaths(paths), true).map(t => ({
                        ...t,
                        actions: [
                            ...(Array.isArray(t.actions) ? t.actions : [t.actions]),
                            assign(() => ({
                                pendingEvent: null,
                                suppressEntryActions: false
                            }))
                        ]
                    })),
                    CONFIRM_NO: {
                        target: `idle`,
                        actions: assign(() => ({
                            pendingEvent: null,
                            suppressEntryActions: true
                        }))
                    }
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
        initializeService: 'initializeService'
    });
    return setup({
        actors: actors || {
            initializeService: fromPromise(async ({ input }) => {
                const {context, sendBack} = input;
                return getInitAction(input);
            })
        }
    }).createMachine(machineDef);
};
