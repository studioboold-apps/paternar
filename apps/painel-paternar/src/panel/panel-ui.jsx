/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * As pecas que toda tela do painel usa. Uma fonte so' para cartao, numero,
 * selo e paginacao: as telas ficam parecidas sem combinar classe por classe.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatNumber } from './panel-format';

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-2xl border border-zinc-800 bg-white shadow-[0_1px_2px_rgba(47,47,81,0.04)]', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {description ? <p className="text-xs text-zinc-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  neutral: 'bg-zinc-950 text-zinc-300 border-zinc-800',
  orange: 'bg-blue-50 text-blue-700 border-blue-200',
  yellow: 'bg-amber-50 text-amber-800 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}

const ICON_TONES = {
  orange: 'bg-blue-50 text-blue-600',
  yellow: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
  navy: 'bg-zinc-950 text-zinc-200',
};

/** Um numero grande com rotulo; clicavel quando leva a uma tela. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'orange', onClick }) {
  const Element = onClick ? 'button' : 'div';
  return (
    <Card className={cn('p-0', onClick && 'transition-shadow hover:shadow-md')}>
      <Element type={onClick ? 'button' : undefined} onClick={onClick} className="flex w-full items-start gap-3 p-4 text-left">
        {Icon ? (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', ICON_TONES[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="block text-xs text-zinc-400">{label}</span>
          <span className="block truncate text-2xl font-bold text-zinc-100">
            {typeof value === 'number' ? formatNumber(value) : value}
          </span>
          {hint ? <span className="block text-xs text-zinc-500">{hint}</span> : null}
        </span>
      </Element>
    </Card>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">{title}</h1>
        {description ? <p className="mt-0.5 max-w-2xl text-sm text-zinc-400">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Loading({ label = 'Carregando…' }) {
  return (
    <p className="flex items-center gap-2 py-8 text-sm text-zinc-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}

export function ErrorText({ error }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.status === 403 ? 'Seu acesso não permite ver isto.' : error.message;
  return <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {Icon ? <Icon className="h-8 w-8 text-zinc-600" /> : null}
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {children ? <p className="max-w-sm text-xs text-zinc-400">{children}</p> : null}
    </div>
  );
}

/** Botoes de escolha unica (periodo, situacao). */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl border border-zinc-800 bg-white p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            option.value === value ? 'bg-brand-orange text-white' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {option.label}
          {option.count ? <span className="ml-1.5 rounded-full bg-white/25 px-1.5 text-xs">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, perPage, total, onChange }) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return <p className="text-xs text-zinc-400">{formatNumber(total)} no total</p>;
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-zinc-400">
      <span>
        {formatNumber(total)} no total · página {page} de {lastPage}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" aria-label="Próxima página" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/** Barra horizontal com rotulo e percentual (funil, ranking). */
export function MeterRow({ label, value, max, suffix }) {
  const width = max ? Math.max(2, Math.round((Number(value) / Number(max)) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="font-semibold text-zinc-100">
          {formatNumber(value)}
          {suffix ? <span className="ml-1 text-xs font-normal text-zinc-400">{suffix}</span> : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-950">
        <div className="h-full rounded-full bg-brand-orange" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function Avatar({ name, className }) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700', className)}>
      {initial}
    </span>
  );
}

export const TABLE_HEAD = 'px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-400';
export const TABLE_CELL = 'px-3 py-2.5 text-sm text-zinc-200';
