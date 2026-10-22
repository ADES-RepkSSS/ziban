import type { ReactNode } from 'react';
import { navigate } from '../app/router';
import { Icon } from './Icon';

interface PageHeaderProps {
  title?: string;
  backTo?: string;
  backLabel?: string;
  right?: ReactNode;
  brand?: boolean;
}

export function PageHeader({
  title,
  backTo = '#/',
  backLabel = '返回',
  right,
  brand = false,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__side">
        <button
          type="button"
          className="header-button"
          onClick={() => navigate(backTo)}
          aria-label={backLabel}
        >
          <Icon name="back" size={30} />
          <span>{backLabel}</span>
        </button>
      </div>

      <div className="page-header__center">
        {brand ? (
          <span className="brand-mark" aria-label="字伴">
            <span className="brand-mark__seal">字</span>
            <span className="brand-mark__name">字伴</span>
          </span>
        ) : title ? (
          <span className="page-header__title">{title}</span>
        ) : null}
      </div>

      <div className="page-header__side page-header__side--right">{right}</div>
    </header>
  );
}
