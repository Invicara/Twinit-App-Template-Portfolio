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