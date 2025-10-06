import { NavLink } from 'react-router-dom';
import { ReactNode } from 'react';

interface SSRSafeNavLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
}

export function SSRSafeNavLink({ to, children, className }: SSRSafeNavLinkProps) {
  // During SSR, render a regular div instead of NavLink
  if (typeof window === 'undefined') {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  // On client side, render the actual NavLink
  return (
    <NavLink to={to} className={className}>
      {children}
    </NavLink>
  );
}