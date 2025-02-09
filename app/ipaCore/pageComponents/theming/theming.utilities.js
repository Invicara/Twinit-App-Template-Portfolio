import { IafProj, IafFile } from "@dtplatform/platform-api"

export const INPUT_TYPES = {
    COLOR_PICKER: 'color_picker',
    FILE_UPLOAD: 'file_upload',
    TEXT: 'text'
}

export const FILE_CONTAINER_SHORTNAME = 'usergroup_files'

export const getUserGroupFileContainer = async ({ userGroupId }) => {
    const project = await IafProj.getCurrent()
    const userGroups = await IafProj.getUserGroups(project)
    const currentUserGroup = userGroups.find(ug => ug._id == userGroupId)
    const relatedFileContainer = currentUserGroup?._userAttributes?.fileContainers?.find(fc => fc._shortName == FILE_CONTAINER_SHORTNAME)
    if (relatedFileContainer) {
        return IafFile.getContainer(relatedFileContainer._id)
    } else {
        console.error('A file container has not been setup for this user group: ', currentUserGroup._name)
    }
}

export const THEME_SETTINGS_CONFIG = [
    {
        groupName: 'Theme',
        items: [
            {
                id: '--app-accent-color',
                label: 'App accent color',
                description: 'Change the primary color for the app interface.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: 'app_logo',
                label: 'App logo',
                description: 'Choose an image to use as your app\'s logo.',
                inputType: INPUT_TYPES.FILE_UPLOAD
            },
            {
                id: 'app_title',
                label: 'App title',
                description: 'Enter a title for your app.',
                inputType: INPUT_TYPES.TEXT
            },
        ]
    },
    {
        groupName: 'Top navigation',
        items: [
            {
                id: '--head-bkg-color',
                label: 'Background color',
                description: 'Change the color for the top navigation background.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--head-appname-color',
                label: 'App & user name color',
                description: 'Change the color for the app and user name text.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--head-menu-bkg-color',
                label: 'Menu background color',
                description: 'Change the background color for the dropdown menu.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--head-menu-hover-color',
                label: 'Menu hover color',
                description: 'Change the hover color for the dropdown menu.',
                inputType: INPUT_TYPES.COLOR_PICKER
            }
        ]
    },
    {
        groupName: 'Side navigation',
        items: [
            {
                id: '--nav-bkg-color',
                label: 'Background color',
                description: 'Change the color for the left navigation background.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--nav-icon-color',
                label: 'Icon color',
                description: 'Change the icon color for the left navigation background.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--nav-hover-color',
                label: 'Hover color',
                description: 'Change the hover color for the left navigation.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--nav-activegrp-bkg-color',
                label: 'Active background color',
                description: 'Change the icon color for active items in the left navigation.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
        ]
    },
    {
        groupName: 'Tree search',
        items: [
            {
                id: '--fancytree-one-color',
                label: 'First level color',
                description: 'Change the color for the button radius at the first level in Tree Search.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--fancytree-one-channel-color',
                label: 'First level channel color',
                description: 'Change the color for the side button radius at the first level in Tree Search.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--fancytree-two-color',
                label: 'Second level channel color',
                description: 'Change the color for the button radius at the second level in Tree Search.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--fancytree-two-channel-color',
                label: 'Second level channel color',
                description: 'Change the color for the side button radius at the second level in Tree Search.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--fancytree-three-color',
                label: 'Third level channel color',
                description: 'Change the color for the button radius at the third level in Tree Search.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
            {
                id: '--fancytree-three-channel-color',
                label: 'Third level channel color',
                description: 'Change the color for the side button radius at the third level in Tree Search.',
                inputType: INPUT_TYPES.COLOR_PICKER
            },
        ]
    },
]