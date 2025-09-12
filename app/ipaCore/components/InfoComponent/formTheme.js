// theme.ts
import { createTheme } from '@mui/material/styles';

export const formTheme = createTheme({
    components: {
        // Make all TextFields use the "standard" variant by default (not "outlined")
        MuiTextField: {
            defaultProps: {
                variant: 'standard',
                fullWidth: true,
            },
        },
        // Remove the underline for standard and filled variants
        MuiInput: {
            defaultProps: { disableUnderline: true },
            styleOverrides: {
                root: {
                    '&:before, &:after': { borderBottom: 'none' },
                    '&:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                },
            },
        },
        MuiFilledInput: {
            defaultProps: { disableUnderline: true },
            styleOverrides: {
                root: {
                    '&:before, &:after': { borderBottom: 'none' },
                    '&:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                },
            },
        },
        // Color the required asterisk
        MuiFormLabel: {
            styleOverrides: {
                asterisk: { color: '#d32f2f' }, // or (theme) => ({ color: theme.palette.error.main })
            },
        },
        // Optional: tighter dense spacing if you like that list look
        MuiFormControl: {
            defaultProps: { margin: 'dense' },
        },
    },
});
