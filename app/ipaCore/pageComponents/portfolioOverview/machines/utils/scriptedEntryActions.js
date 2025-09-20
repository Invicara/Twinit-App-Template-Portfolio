import {  getInitAction as getScriptedInitAction, getEntryAction as getScriptedEntryAction,  getExitAction as getScriptedExitAction } from '../../../../../client/scripts/mapEntryActions.mjs';

async function executeScriptedInitAction(mapMachineInput) {

    const {context} = mapMachineInput;
    const {mmvSend} = context;

    const {commands, ...result} = await getScriptedInitAction({mapMachineInput});

    if(commands && mmvSend) {
        mmvSend(commands);
    }

    return result;
}

async function executeScriptedEntryAction(mapMachineInput) {

    const {context} = mapMachineInput;
    const {mmvSend} = context;

    let result = {}
    let mmvCommands = [];
    try {
        const {commands, ...rest} = await getScriptedEntryAction({mapMachineInput});
        result = {...result, ...rest};
        mmvCommands = commands;
    } catch(err) {
        console.error(err);
    }

    if(mmvCommands && mmvSend) {
        mmvSend(mmvCommands);
    }

    return result;
}

async function executeScriptedExitAction(mapMachineInput) {

    const {context} = mapMachineInput;
    const {mmvSend} = context;

    let result = {}
    let mmvCommands = [];
    try {
        const {commands, ...rest} = await getScriptedExitAction({mapMachineInput});
        result = {...result, ...rest};
        mmvCommands = commands;
    } catch(err) {
        console.error(err);
    }
    if(mmvCommands && mmvSend) {
        mmvSend(mmvCommands);
    }

    return result;
}

export async function getInitAction(mapMachineInput) {
    return executeScriptedInitAction(mapMachineInput);
}

export async function getEntryAction(mapMachine) {
    return executeScriptedEntryAction(mapMachine);
}

export async function getExitAction(mapMachineInput) {
    return executeScriptedExitAction(mapMachineInput);
}
