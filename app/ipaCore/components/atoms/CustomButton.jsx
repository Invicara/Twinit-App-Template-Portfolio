import React from 'react';
import { Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
    // Custom styles can be added here if needed beyond the theme
    customButton: {
        // Any additional custom styling
        '&.Mui-disabled': {
            cursor: 'not-allowed',
        }
    }
}));

/**
 * CustomButton - A themed button component following Hitachi design system
 * 
 * @param {Object} props - Button props
 * @param {string} props.variant - Button variant: 'contained', 'outlined', 'text'
 * @param {string} props.color - Button color: 'primary', 'secondary'
 * @param {string} props.size - Button size: 'small', 'medium', 'large'
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {function} props.onClick - Click handler
 * @param {React.ReactNode} props.children - Button content
 */
const CustomButton = ({
    variant = 'contained',
    color = 'primary',
    size = 'medium',
    disabled = false,
    onClick,
    children,
    className = '',
    ...props
}) => {
    const classes = useStyles();

    return (
        <Button
            variant={variant}
            color={color}
            size={size}
            disabled={disabled}
            onClick={onClick}
            className={`${classes.customButton} ${className}`}
            {...props}
        >
            {children}
        </Button>
    );
};

export default CustomButton;
