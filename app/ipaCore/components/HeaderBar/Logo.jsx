import React, { useEffect, useState } from "react"

import { getUserGroupFileContainer } from "../../pageComponents/theming/theming.utilities"
import { getFileUrlFromFilename } from "../../../services/utils"
import TwinitLogo from "../../../assets/images/invicara-logo_white.svg"

const Logo = ({ userGroupId, appImageSettings }) => {
    const [imgSrc, setImgSrc] = useState()
    useEffect(async () => {
        const { url, filename } = appImageSettings
        if (url) {
            setImgSrc(url)
        } else if (filename) {
            const groupContainer = await getUserGroupFileContainer({ userGroupId })
            if (groupContainer) {
                const url = await getFileUrlFromFilename({ filename, container: groupContainer })
                setImgSrc(url)
            } else {
                // TODO: Set fallback logo
                throw new Error('Could not find logo file container')
            }
        } else {
            setImgSrc(TwinitLogo)
        }
    }, [userGroupId, appImageSettings])

    return (
        <div id="logo" className="logo-wrapper">
            <a href="#/">
                <img src={imgSrc} />
            </a>
        </div>
    )
}

export default Logo
