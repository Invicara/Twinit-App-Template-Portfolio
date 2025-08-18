// hierarchicalMapMachine.test.js (XState v5 + portfolio/district path)
import {createActor, fromPromise} from 'xstate';
import { createMachine } from './hierarchicalMapMachine.js';

const namedPaths = [
    [
        { state: 'portfolio', idKey: null },
        { state: 'district', idKey: 'districtId', feature: true },
        { state: 'building', idKey: 'buildingId' },
        { state: 'modelElement', idKey: 'modelElementId' },
    ]
];

function getSnapshotDescription(snap) {
    const {...rest} = snap.context;
    return `State: ${JSON.stringify(snap.value)},\nContext: ${JSON.stringify(rest, null, 2)}`;
}

function expectState(snapshot, expectedPath) {
    const pass = snapshot.matches(expectedPath);
    if (!pass) {
        const description = getSnapshotDescription(snapshot);
        throw new Error(`Expected state to be '${expectedPath}', but got:\n${description}`);
    }
}

function waitForMatch(actor, matcher, timeout = 1000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), timeout);

        const sub = actor.subscribe((snapshot) => {
            if (matcher(snapshot)) {
                clearTimeout(timeoutId);
                sub.unsubscribe();
                resolve(snapshot);
            }
        });
    });
}

async function createActorAndWaitForMap(machineDef) {
    const actor = createActor(machineDef).start();
    actor.send({ type: 'MAP_READY', map: {} });
    await waitForMatch(actor, (s) => s.matches('portfolio.idle'));
    console.log("createActorAndWaitForMap",getSnapshotDescription(actor.getSnapshot()))
    return actor
}

describe('portfolioMapMachine - GO_TO event hierarchy handling', () => {
    const machineDef = createMachine("mapMachine",namedPaths,{
        actors: {
            addLayersService: fromPromise(async ({ input }) => {
                //console.log("service");
                return Promise.resolve({})
            }),
        },
        actions: {
            resetMap: ({context}) => {}
        }
    });

    it('transitions to portfolio.idle', async () => {
        const actor = await createActorAndWaitForMap(machineDef);
        expectState(actor.getSnapshot(), 'portfolio.idle');
    });

    it('transitions to portfolio.district.idle with districtId only', async () => {
        const actor = await createActorAndWaitForMap(machineDef);
        actor.send({ type: 'GO_TO', districtId: 'district-1' });
        expectState(await actor.getSnapshot(), 'portfolio.district.idle');
    });

    it('transitions to portfolio.district.building.idle with districtId and buildingId', async () => {
        const actor = await createActorAndWaitForMap(machineDef);
        actor.send({ type: 'MAP_READY', map: {} });
        actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: 'B1' });
        await actor.getSnapshot();
        expectState(actor.getSnapshot(), 'portfolio.district.building.idle');
    });

    it('transitions to modelElement.viewing with all IDs', async () => {
        const actor = await createActorAndWaitForMap(machineDef);
        actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: 'B1', modelElementId: 'M1' });
        await actor.getSnapshot();
        expectState(actor.getSnapshot(), 'portfolio.district.building.modelElement.idle');
    });

    it('bubbles up to building.idle if modelElementId is null', async () => {
        const actor = await createActorAndWaitForMap(machineDef);
        actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: 'B1', modelElementId: 'M1' });
        await actor.getSnapshot();

        actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: 'B1', modelElementId: null });
        await actor.getSnapshot();
        expectState(actor.getSnapshot(), 'portfolio.district.building.idle');
    });

    it('bubbles up to district.idle if buildingId and modelElementId are null', async () => {
        const actor = await createActorAndWaitForMap(machineDef);
        actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: 'B1', modelElementId: 'M1' });
        await actor.getSnapshot();
        expectState(actor.getSnapshot(), 'portfolio.district.building.modelElement.idle');
        actor.send({ type: 'GO_TO', districtId: 'D1' });
        await actor.getSnapshot();
        expectState(actor.getSnapshot(), 'portfolio.district.idle');

        //actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: null, modelElementId: null });
        //await actor.getSnapshot();
        //expectState(actor.getSnapshot(), 'portfolio.district.idle');
    });

    it('bubbles all the way up to portfolio.idle if all IDs are null', async () => {
        const actor = await createActorAndWaitForMap(machineDef);
        actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: 'B1', modelElementId: 'M1' });
        await actor.getSnapshot();

        actor.send({ type: 'GO_TO' });
        await actor.getSnapshot();
        expectState(actor.getSnapshot(), 'portfolio.idle');
    });

    it('does not reenter if IDs match current context', async () => {
        const actor = await createActorAndWaitForMap(machineDef);
        actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: 'B1' });
        await actor.getSnapshot();

        const prev = actor.getSnapshot();
        actor.send({ type: 'GO_TO', districtId: 'D1', buildingId: 'B1' });
        const after = actor.getSnapshot();

        expect(after.value).toEqual(prev.value);
        expectState(after, 'portfolio.district.building.idle');
    });

    /*
    it('transitions through MAP_READY and invokes addLayers service', async () => {
        const mockFn = jest.fn(() => async () => Promise.resolve());
        const machineWithMap = generateMapMachine(namedPaths, { addLayers: mockFn });
        const actor = await createActorAndWaitForMap(machineDef);
        await actor.getSnapshot();
        expect(mockFn).toHaveBeenCalled();
    });*/
});
