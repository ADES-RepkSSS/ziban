import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber';
type Size = 'normal' | 'large' | 'huge';

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  iconSize?: number;
  full?: boolean;
  children: ReactNode;
}

export function BigButton({
  variant = 'secondary',
  size = 'large',
  icon,
  iconPosition = 'left',
  iconSize,
  full = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: BigButtonProps) {
  const classes = [
    'big-button',
    `big-button--${variant}`,
    `big-button--${size}`,
    full ? 'big-button--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconNode = icon ? <Icon name={icon} size={iconSize ?? (size === 'huge' ? 42 : 34)} /> : null;

  return (
    <button type={type} className={classes} {...rest}>
      {icon && iconPosition === 'left' ? iconNode : null}
      <span className="big-button__label">{children}</span>
      {icon && iconPosition === 'right' ? iconNode : null}
    </button>
  );
}
