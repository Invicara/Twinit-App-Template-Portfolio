import {useCallback, useEffect, useRef, useState} from "react";
import _ from "lodash";

export function usePopupState(initialState){

    const [popupState, setPopupState] = useState(initialState);
    const popupStateRef = useRef(popupState);
    useEffect(()=>{
        popupStateRef.current = popupState;
    },[popupState])
    const setPopupStateIfChanged = useCallback((state)=>{
        const input = typeof state === "function" ? state(popupStateRef.current) : state;
        if(!_.isEqual(popupStateRef.current, input)){
            setPopupState(state);
        }
    },[setPopupState])

    return [popupState, setPopupStateIfChanged];
}
