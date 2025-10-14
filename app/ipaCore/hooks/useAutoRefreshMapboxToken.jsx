import {useEffect, useRef, useState} from "react";
import {getTemporaryMapBoxTokenWithMeta} from "../pageComponents/utils/mapboxUtils.js";

export function useAutoRefreshToken() {
    const timeoutRef = useRef(null);

    const [tokenInfo, setTokenInfoInfo] = useState();

    const getMapboxToken = async () => {
        let tokenWithMeta = await getTemporaryMapBoxTokenWithMeta()

        if (tokenWithMeta) {
            setTokenInfoInfo(tokenWithMeta)
        }
    }

    useEffect(() => {
        if (!tokenInfo?.expires) return;

        // Clear any existing timeout when token changes
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Determine how long until expiration
        const expiresAt = typeof tokenInfo.expires === "string"
            ? new Date(tokenInfo.expires).getTime()
            : tokenInfo.expires;

        const now = Date.now();

        // Refresh 60 seconds before expiration
        const refreshDelay = Math.max(expiresAt - now - 60_000, 0);

        timeoutRef.current = setTimeout(() => {
            console.log("Refreshing Mapbox token...");
            getMapboxToken(); // Your function to refresh the token
        }, refreshDelay);

        // Cleanup on unmount
        return () => clearTimeout(timeoutRef.current);
    }, [tokenInfo]);
}

export default useAutoRefreshToken;
