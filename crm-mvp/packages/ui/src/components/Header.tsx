import React from 'react';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; path?: string }[];
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions, breadcrumb }) => {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-2 text-sm mb-3">
          {breadcrumb.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="text-text-muted">/</span>}
              {item.path ? (
                <a href={item.path} className="text-text-muted hover:text-accent transition-colors">
                  {item.label}
                </a>
              ) : (
                <span className="text-text-primary">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export interface PageShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({ children, header, sidebar }) => {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex">
      {sidebar}
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {header}
          {children}
        </div>
      </main>
    </div>
  );
};
