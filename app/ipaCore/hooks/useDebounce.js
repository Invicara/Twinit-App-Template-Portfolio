import React, { useRef, useEffect, useMemo } from "react";
import _ from "lodash";

export const useDebounce = (cb, time) => {
    const ref = useRef();

    useEffect(() => {
        ref.current = cb;
    }, [cb]);

    const debouncedCallback = useMemo(() => {
        const func = (...arg) => {
            ref.current?.(...arg);
        };

        return _.debounce(func, time);
    }, []);

    return debouncedCallback;
};

export const useCancellableDebounce = (cb, time) => {
    const ref = useRef();

    useEffect(() => {
        ref.current = cb;
    }, [cb]);

    const debouncedCallback = useMemo(() => {
        const func = (...arg) => {
            ref.current?.(...arg);
        };

        return _.debounce(func, time);
    }, []);

    const cancel = () => {
        ref.current = undefined;
    }

    return [debouncedCallback, cancel];
};
