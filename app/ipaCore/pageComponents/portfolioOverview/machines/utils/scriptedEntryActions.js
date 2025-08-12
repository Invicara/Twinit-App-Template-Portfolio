import { getEntryAction as getScriptedEntryAction, getInitAction as getScriptedInitAction } from '../../../../../client/scripts/mapEntryActions.mjs';

export async function getEntryAction(mapMachine) {
    return executeScriptedEntryAction(mapMachine);
}
export async function getInitAction(mapMachineInput) {
    return executeScriptedInitAction(mapMachineInput);
}

async function executeScriptedEntryAction(mapMachineInput) {

    const {context} = mapMachineInput;
    const {mmvSend} = context;

    const {commands, ...result} = await getScriptedEntryAction({mapMachineInput});

    if(commands && mmvSend) {
        mmvSend(commands);
    }
}

async function executeScriptedInitAction(mapMachineInput) {

    const {context} = mapMachineInput;
    const {mmvSend} = context;

    const {commands, ...result} = await getScriptedInitAction({mapMachineInput});

    if(commands && mmvSend) {
        mmvSend(commands);
    }

    return result;
}
