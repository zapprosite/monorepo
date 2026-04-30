import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface KPICardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  trend,
  className = '',
}) => {
  return (
    <div className={`bg-bg-secondary rounded-card border border-white/5 p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-text-muted font-medium">{title}</p>
          <p className="text-kpi text-accent mt-2">{value}</p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              {trend.direction === 'up' && <TrendingUp size={14} className="text-accent" />}
              {trend.direction === 'down' && <TrendingDown size={14} className="text-danger" />}
              <span
                className={`text-xs font-medium ${
                  trend.direction === 'up'
                    ? 'text-accent'
                    : trend.direction === 'down'
                    ? 'text-danger'
                    : 'text-text-muted'
                }`}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-text-muted">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
