import { IafFile, IafFileSvc } from "@dtplatform/platform-api"

export const getGreeting = ({name}) => {
    const hours = (new Date()).getHours()

    let period = 'Morning'
    if (hours >= 12 && hours < 18) period = 'Afternoon'
    else if (hours >= 18) period = 'Evening'

    return `Good ${period}, ${name}!`
}

export const hexToRgb = (hex) => {
    return hex
        .replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
        .substring(1).match(/.{2}/g)
        .map(x => parseInt(x, 16))
}

export const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map(x => {
        const hex = parseInt(x).toString(16).toUpperCase()
        return hex.length === 1 ? '0' + hex : hex
    })
    .join('')
}

export const regexBetween0and255 = /^([0-1]?[0-9]?[0-9]|[2][0-4][0-9]|25[0-5])$/

export const regexHexColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/

export const toTitleCase = (str) => {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

export const getFileUrlFromFilename = async ({ filename, container }) => {
    let currentContainer = container
    if (!container) {
        const project = await IafProj.getCurrent()
        currentContainer = project?.rootContainer
    }

    const fileItems = await IafFile.getFileItems(currentContainer, { name: filename })
    const fileItem = _.find(fileItems?._list, { name: filename })
    if(!fileItem) {
        return null
    }
    const fileVersion = _.find(fileItem.versions, { versionNumber: fileItem.tipVersionNumber })
    const result = await IafFileSvc.getFileVersionUrl(fileItem._fileId, fileVersion._fileVersionId)

    return result._url
}

/**
 * Extract full hierarchical path keys from XState v5 snapshot.value
 * e.g. { portfolio: { site: { building: 'idle' } } } -> ['portfolio','site','building']
 */
export function getActiveChain(snapshotValue) {
    const chain = [];
    let node = snapshotValue;
    while (node && typeof node === 'object') {
        const [k] = Object.keys(node);
        if (!k) break;
        chain.push(k);
        node = node[k];
    }
    return chain;
}

export function getActiveLevels(currentState){

    const namedPath = currentState.context.namedPaths[0];

    const chain = getActiveChain(currentState.value);

    // map chain to level defs (from namedPath)
    const levels = chain
        .map(stateName => namedPath.find(l => l.state === stateName))
        .filter(Boolean); // only those defined in namedPath

    return levels;
}

/**
 * Get a cached file URL from sessionStorage or fetch from platform if expired/missing
 * URLs from platform live 48 hours, but we cache for 40 hours for safety
 * 
 * @param {string} fileId - The file ID to get the URL for
 * @returns {Promise<string|null>} - The file URL or null if not found
 */
export const getCachedFile = async (fileId) => {
    if (!fileId) {
        console.warn('getCachedFile: fileId is required');
        return null;
    }

    const cacheKey = `fileUrl_${fileId}`;
    const CACHE_DURATION_MS = 40 * 60 * 60 * 1000; // 40 hours in milliseconds
    
    try {
        // Check sessionStorage for cached URL
        const cachedData = sessionStorage.getItem(cacheKey);
        
        if (cachedData) {
            const { url, timestamp } = JSON.parse(cachedData);
            const now = Date.now();
            
            // Check if cached URL is still valid (within 40 hours)
            if (now - timestamp < CACHE_DURATION_MS) {
                console.log(`getCachedFile: Using cached URL for fileId ${fileId}`);
                return url;
            } else {
                console.log(`getCachedFile: Cached URL expired for fileId ${fileId}, fetching new one`);
                // Remove expired cache entry
                sessionStorage.removeItem(cacheKey);
            }
        }

        // Fetch new URL from platform
        console.log(`getCachedFile: Fetching URL from platform for fileId ${fileId}`);
        const result = await IafFileSvc.getFileUrl(fileId);
        
        if (result && result._url) {
            // Cache the URL with current timestamp
            const cacheData = {
                url: result._url,
                timestamp: Date.now()
            };
            
            sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log(`getCachedFile: Cached new URL for fileId ${fileId}`);
            
            return result._url;
        } else {
            console.warn(`getCachedFile: No URL found for fileId ${fileId}`);
            return null;
        }
        
    } catch (error) {
        console.error(`getCachedFile: Error getting file URL for fileId ${fileId}:`, error);
        return null;
    }
};

