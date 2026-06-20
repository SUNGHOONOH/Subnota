import {
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Tooltip, type FloatingPosition } from '@mantine/core';

interface TooltipIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  delay?: number;
  placement?: FloatingPosition;
  tooltip: string;
}

const TooltipIconButton = ({
  children,
  className,
  delay = 500,
  disabled = false,
  onClick,
  placement = 'top',
  tabIndex,
  tooltip,
  type = 'button',
  ...props
}: TooltipIconButtonProps) => {
  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick?.(event);
  };

  return (
    <Tooltip label={tooltip} position={placement} openDelay={delay}>
      <button
        {...props}
        aria-disabled={disabled || undefined}
        className={className}
        onClick={handleClick}
        tabIndex={disabled ? -1 : tabIndex}
        type={type}
      >
        {children}
      </button>
    </Tooltip>
  );
};

export default TooltipIconButton;
