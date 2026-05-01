import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent'
  | 'outline'
  | 'ghost';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', children, className = '', ...props }, ref) => {
    const variants: Record<BadgeVariant, string> = {
      default: 'bg-white/10 text-text-secondary border-white/10',
      success: 'bg-accent/10 text-accent border-accent/20',
      warning: 'bg-warning/10 text-warning border-warning/20',
      danger: 'bg-danger/10 text-danger border-danger/20',
      info: 'bg-info/10 text-info border-info/20',
      accent: 'bg-accent/15 text-accent border-accent/30',
      outline: 'bg-transparent text-text-secondary border-white/20',
      ghost: 'bg-transparent text-text-muted border-transparent',
    };

    return (
      <span
        ref={ref}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Status badge helper for CRM entities
export const StatusBadge: React.FC<{
  status: string;
  mapping?: Record<string, BadgeVariant>;
  label?: string;
}> = ({ status, mapping, label }) => {
  const defaultMapping: Record<string, BadgeVariant> = {
    // Leads
    novo: 'default',
    contato: 'info',
    qualificado: 'info',
    proposta: 'warning',
    negociacao: 'warning',
    ganho: 'success',
    perdido: 'danger',
    // Clients
    ativo: 'success',
    inativo: 'ghost',
    // Schedules
    agendado: 'info',
    confirmado: 'accent',
    em_andamento: 'warning',
    concluido: 'success',
    cancelado: 'danger',
    // Contracts
    rascunho: 'default',
    suspenso: 'warning',
    encerrado: 'ghost',
    // Reminders (concluido already defined above)
    pendente: 'warning',
    // Service Orders
    orcamento: 'info',
    aprovada: 'accent',
    // Equipamentos
    em_manutencao: 'warning',
  };

  const variant = mapping?.[status] || defaultMapping[status] || 'default';
  const displayLabel = label ?? status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return <Badge variant={variant}>{displayLabel}</Badge>;
};
