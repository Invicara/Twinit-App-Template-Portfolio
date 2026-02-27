// Converted from MUI v4 to MUI v5
// Source: your defaultTheme.js
// Key changes:
// - import from '@mui/material/styles'
// - palette.type -> palette.mode
// - overrides -> components + styleOverrides/defaultProps
// - updated a few state selectors to v5 classnames (e.g., .Mui-focused)

import { createTheme } from '@mui/material/styles';

const faricy = {
    fontStyle: 'normal',
    fontWeight: 400,
};

export const DRAWER_WIDTH = 370;

export const colorPalette = {
    white: '#fff',
    black: '#000',
    disabled: '#969696',
    lightGrey: '#AEB1B7',
    grey: '#6A6B86',
    greyBlue: '#D2DBE7',
    red: '#CB2630',
    blue: '#2964B4',
    green: '#4F7471',
    semantic: '#29B482',
    lightBlue: '#F3F7FC',
    greyBg: '#EBEBED',
    textColor: '#101217',
    darkGreen: '#91A8A7',
    primary: {
        light: '#DF158C',
        lighter: '#d6c1cd',
        main: '#DF158C',
        dark: '#DF158C',
        darker: '#1E232D',
    },
    secondary: {
        light: '#ffc044',
        lighter: 'rgba(189, 129, 40, 1)',
        main: '#CB2630',
        dark: '#CB2630',
        darker: '#CB2630',
    },
    neutral: {
        light: 'rgba(255,255,255,0.5)',
        lighter: '#C2C4C9',
        dark: '#1E232D',
        darker: 'rgba(0, 0, 0, 0.87)',
    },
    info: {
        light: '#E8F1FC',
        lighter: '#96B1D9',
        main: '#657FA6',
        dark: '#0B64DA',
        darker: '#003781',
    },
    success: {
        light: '#F0FDF4',
        lighter: '#BBF7D0',
        main: '#4ADE80',
        dark: '#16A34A',
        darker: '#166534',
    },
    warn: {
        light: '#FFFBEB',
        lighter: '#FDE68A',
        main: '#CB2630',
        dark: '#D97706',
        darker: '#92400E',
    },
    error: {
        light: '#FEF2F2',
        lighter: '#FECACA',
        main: '#CB2630',
        dark: '#CB2630',
    },
    deleteTheme: {
        light: '#FEF2F2',
        lighter: '#FECACA',
        main: '#CB2630',
        darker: '#CB2630',
    },
    darkTheme: {
        textColor: '#FFFFFF',
    },
};

export const palette = {
    neutral: {
        '0': '#FFFFFF',
        '50': '#F9F9F9',
        '100': '#F3F3F3',
        '200': '#EBEBEB',
        '300': '#DCDCDC',
        '500': '#999999',
        '600': '#707070',
        '700': '#5D5D5D',
        '800': '#3E3E3E',
        '900': '#1D1D1D',
        opacity: 'rgba(255,255,255,0.6)',
    },
    brand: {
        '300': '#cbd7d4',
        '800': '#5b8a7b',
    },
    error: '#D32F2F',
    success: '#48A045',
};

// Base (light) theme options
const baseOptions = {
    palette: {
        mode: 'light',
        secondary: colorPalette.secondary,
        primary: colorPalette.primary,
        error: colorPalette.deleteTheme,
        divider: colorPalette.lightGrey,
        text: {
            primary: '#1D1D1D',
            secondary: '#5D5D5D',
        },
        background: {
            default: '#FFFFFF',
            secondary: '#EBEBEB',
            dark: '#3E3E3E',
            dashboard: '#F2F2F2',
            paper: '#FFFFFF',
            progress: '#DCDCDC',
            select: '#FDF3F9',
        },
        // Custom keys are fine in JS (augment in TS if needed)
        border: {
            default: '#EBEBEB',
        },
    },
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 900,
            lg: 1200,
            xl: 1536,
        },
    },
    direction: 'ltr',
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                '@font-face': [faricy],
            },
        },
        MuiAccordion: {
            defaultProps: {
                square: true, // no rounded corners
            },
            styleOverrides: {
                root: {
                    backdropFilter: 'blur(4px)',
                    borderRadius: 0, // defensive: stay square even if something adds radius
                    '&.Mui-expanded': {
                        margin: 0, // kill the default expanded margin
                    },
                },
            },
        },
        MuiAccordionDetails: {
            styleOverrides: {
                root: {
                    padding: 0, // no inner padding
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                rounded: {
                    borderRadius: 0,
                },
            },
        },
        MuiButton: {
            variants: [
                {
                    props: { variant: 'contained', color: 'primary' },
                    style: {
                        backgroundColor: colorPalette.primary.light,
                        color: colorPalette.white,
                        '&:hover': { backgroundColor: colorPalette.primary.main },
                    },
                },
                {
                    props: { variant: 'text', color: 'primary' },
                    style: {
                        color: colorPalette.primary.light,
                    },
                },
            ],
            styleOverrides: {
                root: {
                    padding: '8px 42px',
                    borderRadius: 4,
                    fontSize: 15,
                    transitionDuration: '0.25s',
                },
                outlined: {
                    backgroundColor: colorPalette.neutral.light,
                    color: colorPalette.primary.light,
                    border: '1px solid #B8B8B8',
                    padding: '8px 42px',
                    boxShadow: '0px 7px 19px 0px #29263212',
                    '&:hover': {
                        color: colorPalette.primary.main,
                        backgroundColor: `${colorPalette.white} !important`,
                        border: `1px solid ${colorPalette.primary.darker}`,
                        boxShadow: '0px 7px 19px 0px #DA9A3A26',
                    },
                },
                contained: {
                    color: colorPalette.white,
                    backgroundColor: colorPalette.primary.light,
                    '&:hover': {
                        color: colorPalette.white,
                        backgroundColor: colorPalette.primary.main,
                    },
                },
                outlinedSecondary: {
                    '&:hover': {
                        color: colorPalette.secondary.main,
                    },
                },
                containedPrimary: {
                    backdropFilter: 'blur(10px)',
                    borderRadius: 4,
                    backgroundColor: colorPalette.primary.light,
                },
                containedSecondary: {
                    borderRadius: 4,
                },
            },
        },
        MuiTypography: {
            styleOverrides: {
                colorPrimary: {
                    color: colorPalette.primary.main,
                },
                root: {
                    color: colorPalette.black,
                },
            },
        },
        MuiBackdrop: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paperFullWidth: {
                    borderRadius: 6,
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                },
            },
        },
        MuiFab: {
            styleOverrides: {
                root: {
                    backdropFilter: 'blur(2px)',
                },
            },
        },
        MuiFormControl: {
            styleOverrides: {
                root: {},
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 0,
                    '& .MuiOutlinedInput-notchedOutline': {
                        border: '1px solid rgba(134, 138, 147, 1)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        border: '1px solid rgba(134, 138, 147, 1)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        border: '1px solid rgba(134, 138, 147, 1)',
                    },
                },
                notchedOutline: {
                    top: 0,
                    border: '1px solid rgba(134, 138, 147, 1)',
                },
                input: {
                    padding: '8px',
                },
            },
        },
        MuiInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused': {
                        border: `1px solid ${colorPalette.white}`,
                    },
                    '&.Mui-error': {
                        color: colorPalette.error.dark,
                        borderColor: colorPalette.error.dark,
                    },
                },
                underline: {
                    '&:before': {
                        borderBottom: 'none !important',
                    },
                    '&:after': {
                        borderBottom: 'none !important',
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    backgroundColor: `${colorPalette.primary.light} !important`,
                    height: 2.37,
                },
            },
        },
        MuiListItem: {
            styleOverrides: {
                container: {
                    borderBottom: '1px solid #EBEBED',
                    height: 44,
                },
                gutters: {},
            },
        },
        MuiBadge: {
            styleOverrides: {
                dot: {
                    top: '3px !important',
                    minWidth: 6,
                    height: 6,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    minWidth: '90px !important',
                },
                wrapper: {
                    fontWeight: 400,
                    fontSize: 14,
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    alignSelf: 'flex-end',
                    margin: 10,
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                select: {
                    '&:focus': { backgroundColor: 'none' },
                    display: 'flex',
                    alignItems: 'center',
                    paddingRight: '0 !important',
                },
            },
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    padding: '6%',
                },
            },
        },
    },
    shape: {
        borderRadius: 8,
    },
    typography: {
        htmlFontSize: 14,
        fontSize: 14,
        button: {
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '17px',
            lineHeight: 1.75,
            letterSpacing: '0.02857em',
        },
        fontWeightLight: 300,
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,
        h1: {
            fontWeight: 700,
            fontSize: 17,
            lineHeight: 1.167,
            letterSpacing: '-0.01562em',
            color: colorPalette.textColor,
        },
        h2: {
            fontWeight: 300,
            fontSize: '4rem',
            lineHeight: 1.2,
            letterSpacing: '-0.00833em',
            color: colorPalette.textColor,
        },
        h3: {
            fontWeight: 400,
            fontSize: '3.25rem',
            lineHeight: 1.167,
            letterSpacing: '0em',
            color: colorPalette.textColor,
        },
        h4: {
            fontWeight: 400,
            fontSize: '2.25rem',
            lineHeight: 1.235,
            letterSpacing: '0.00735em',
            color: colorPalette.textColor,
        },
        h5: {
            fontWeight: 400,
            fontSize: '1.75rem',
            lineHeight: 1.334,
            letterSpacing: '0em',
        },
        h6: {
            fontWeight: 500,
            fontSize: '1.2rem',
            lineHeight: 1.6,
            letterSpacing: '0.0075em',
            color: colorPalette.textColor,
        },
        subtitle1: {
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.75,
            color: 'grey',
            letterSpacing: '0.00938em',
        },
        subtitle2: {
            fontWeight: 500,
            fontSize: 17,
            lineHeight: 1.57,
            letterSpacing: '0.00714em',
            color: colorPalette.textColor,
        },
        body1: {
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '0.00938em',
            color: colorPalette.textColor,
        },
        body2: {
            fontWeight: 400,
            fontSize: 15,
            lineHeight: 1.43,
            letterSpacing: '0.01071em',
            color: colorPalette.textColor,
        },
        caption: {
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1.8,
            letterSpacing: '0.00938em',
            color: colorPalette.textColor,
        },
        overline: {
            fontWeight: 400,
            fontSize: '1rem',
            lineHeight: 2.66,
            letterSpacing: '0.08333em',
            textTransform: 'uppercase',
        },
    },
    mixins: {
        toolbar: {
            minHeight: 56,
        },
    },
    shadows: [
        'none',
        '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
        '0px 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0px rgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12)',
        '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)',
        '0px 2px 4px -1px rgba(0,0,0,0.2),0px 4px 5px 0px rgba(0,0,0,0.14),0px 1px 10px 0px rgba(0,0,0,0.12)',
        '0px 3px 5px -1px rgba(0,0,0,0.2),0px 5px 8px 0px rgba(0,0,0,0.14),0px 1px 14px 0px rgba(0,0,0,0.12)',
        '0px 3px 5px -1px rgba(0,0,0,0.2),0px 6px 10px 0px rgba(0,0,0,0.14),0px 1px 18px 0px rgba(0,0,0,0.12)',
        '0px 4px 5px -2px rgba(0,0,0,0.2),0px 7px 10px 1px rgba(0,0,0,0.14),0px 2px 16px 1px rgba(0,0,0,0.12)',
        '0px 5px 5px -3px rgba(0,0,0,0.2),0px 8px 10px 1px rgba(0,0,0,0.14),0px 3px 14px 2px rgba(0,0,0,0.12)',
        '0px 5px 6px -3px rgba(0,0,0,0.2),0px 9px 12px 1px rgba(0,0,0,0.14),0px 3px 16px 2px rgba(0,0,0,0.12)',
        '0px 6px 6px -3px rgba(0,0,0,0.2),0px 10px 14px 1px rgba(0,0,0,0.14),0px 4px 18px 3px rgba(0,0,0,0.12)',
        '0px 6px 7px -4px rgba(0,0,0,0.2),0px 11px 15px 1px rgba(0,0,0,0.14),0px 4px 20px 3px rgba(0,0,0,0.12)',
        '0px 7px 8px -4px rgba(0,0,0,0.2),0px 12px 17px 2px rgba(0,0,0,0.14),0px 5px 22px 4px rgba(0,0,0,0.12)',
        '0px 7px 8px -4px rgba(0,0,0,0.2),0px 13px 19px 2px rgba(0,0,0,0.14),0px 5px 24px 4px rgba(0,0,0,0.12)',
        '0px 7px 9px -4px rgba(0,0,0,0.2),0px 14px 21px 2px rgba(0,0,0,0.14),0px 5px 26px 4px rgba(0,0,0,0.12)',
        '0px 8px 9px -5px rgba(0,0,0,0.2),0px 15px 22px 2px rgba(0,0,0,0.14),0px 6px 28px 5px rgba(0,0,0,0.12)',
        '0px 8px 10px -5px rgba(0,0,0,0.2),0px 16px 24px 2px rgba(0,0,0,0.14),0px 6px 30px 5px rgba(0,0,0,0.12)',
        '0px 8px 11px -5px rgba(0,0,0,0.2),0px 17px 26px 2px rgba(0,0,0,0.14),0px 6px 32px 5px rgba(0,0,0,0.12)',
        '0px 9px 11px -5px rgba(0,0,0,0.2),0px 18px 28px 2px rgba(0,0,0,0.14),0px 7px 34px 6px rgba(0,0,0,0.12)',
        '0px 9px 12px -6px rgba(0,0,0,0.2),0px 19px 29px 2px rgba(0,0,0,0.14),0px 7px 36px 6px rgba(0,0,0,0.12)',
        '0px 10px 13px -6px rgba(0,0,0,0.2),0px 20px 31px 3px rgba(0,0,0,0.14),0px 8px 38px 7px rgba(0,0,0,0.12)',
        '0px 10px 14px -6px rgba(0,0,0,0.2),0px 22px 35px 3px rgba(0,0,0,0.14),0px 8px 42px 7px rgba(0,0,0,0.12)',
        '0px 11px 14px -7px rgba(0,0,0,0.2),0px 23px 36px 3px rgba(0,0,0,0.14),0px 9px 44px 8px rgba(0,0,0,0.12)',
        '0px 11px 15px -7px rgba(0,0,0,0.2),0px 24px 38px 3px rgba(0,0,0,0.14),0px 9px 46px 8px rgba(0,0,0,0.12)',
    ],
    transitions: {
        easing: {
            easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
            easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
            easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
            sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
        },
        duration: {
            shortest: 150,
            shorter: 200,
            short: 250,
            standard: 300,
            complex: 375,
            enteringScreen: 225,
            leavingScreen: 195,
        },
    },
    zIndex: {
        mobileStepper: 1000,
        speedDial: 1050,
        appBar: 1100,
        drawer: 1200,
        modal: 1300,
        snackbar: 1400,
        tooltip: 1500,
    },
    // app custom namespace (ok to keep in theme object)
    mmv: {
        mmvTopOffset: 0,
        mmvPageSpacing: {
            mmvTopOffset: 0,
        },
    },
};

export const themeOptions = createTheme(baseOptions);

export const darkTheme = createTheme({
    ...baseOptions,
    palette: {
        ...baseOptions.palette,
        mode: 'dark',
        primary: {
            main: '#DF158C',
        },
        text: {
            primary: '#FFFFFF',
            secondary: '#B8B8B8',
        },
        background: {
            default: '#1D1D1D',
            secondary: '#3E3E3E',
            dark: '#3E3E3E',
            dashboard: '#000000',
            paper: '#1D1D1D',
            progress: '#DCDCDC',
            select: '#3E3E3E',
        },
        border: {
            default: '#3E3E3E',
        },
    },
    typography: {
        ...baseOptions.typography,
        h1: {
            fontWeight: 700,
            fontSize: 17,
            lineHeight: 1.167,
            letterSpacing: '-0.01562em',
            color: colorPalette.darkTheme.textColor,
        },
        h2: {
            fontWeight: 300,
            fontSize: '4rem',
            lineHeight: 1.2,
            letterSpacing: '-0.00833em',
            color: colorPalette.darkTheme.textColor,
        },
        h3: {
            fontWeight: 400,
            fontSize: '3.25rem',
            lineHeight: 1.167,
            letterSpacing: '0em',
            color: colorPalette.darkTheme.textColor,
        },
        h4: {
            fontWeight: 400,
            fontSize: '2.25rem',
            lineHeight: 1.235,
            letterSpacing: '0.00735em',
            color: colorPalette.darkTheme.textColor,
        },
        h6: {
            fontWeight: 500,
            fontSize: '1.2rem',
            lineHeight: 1.6,
            letterSpacing: '0.0075em',
            color: colorPalette.darkTheme.textColor,
        },
        subtitle2: {
            fontWeight: 500,
            fontSize: 17,
            lineHeight: 1.57,
            letterSpacing: '0.00714em',
            color: colorPalette.darkTheme.textColor,
        },
        body1: {
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '0.00938em',
            color: colorPalette.darkTheme.textColor,
        },
        body2: {
            fontWeight: 400,
            fontSize: 15,
            lineHeight: 1.43,
            letterSpacing: '0.01071em',
            padding: '10px 0',
            color: colorPalette.darkTheme.textColor,
        },
        caption: {
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1.8,
            letterSpacing: '0.00938em',
            color: colorPalette.darkTheme.textColor,
        },
    },
    components: {
        ...baseOptions.components,
        MuiButton: {
            ...baseOptions.components.MuiButton,
            styleOverrides: {
                ...baseOptions.components.MuiButton.styleOverrides,
                outlined: {
                    backgroundColor: 'transparent',
                    color: colorPalette.primary.light,
                    border: '1px solid #B8B8B8',
                    padding: '8px 42px',
                    boxShadow: '0px 7px 19px 0px #29263212',
                    '&:hover': {
                        border: `1px solid ${colorPalette.primary.darker}`,
                    },
                },
            },
        },
    },
});

const { spacing } = themeOptions;

export const dropdownCheckIcon = {
    width: 8,
    height: 8,
    color: colorPalette.grey,
};

export const SPACING = {
    SIDE_BAR_WIDTH: spacing(6),
    APP_BAR_HEIGHT: spacing(7),
    BREADCRUMB_HEIGHT: spacing(5),
};

export const SIDE_DRAWER_STYLE = {
    containerHeight: `calc(100vh - 50px - 40px)`, // this appears to render under the breadcrumbs that are 40px
    containerHeightRight: `calc(100vh - 50px - 40px)`,
    tabHeight: '48px',
    contentContainerHeight: 'calc(100vh - 51px - 40px - 48px)',
};

export const BOX_SHADOW = '0px 0px 8px 0px rgba(53, 60, 75, 0.16)';
