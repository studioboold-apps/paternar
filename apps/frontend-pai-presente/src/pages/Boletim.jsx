/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { Award, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import BoletimCharts from '@/components/BoletimCharts';
import BoletimQuickAccess from '@/components/BoletimQuickAccess';
import BoletimQuickStats from '@/components/BoletimQuickStats';
import PlanUpsell from '@/components/PlanUpsell';
import { PLAN_LOCKS } from '@/lib/use-plan';
import BoletimReportCard from '@/components/BoletimReportCard';
import BoletimShare from '@/components/BoletimShare';
import { Button } from '@/components/ui/button';
import ChildQuickAccess from '@/components/ChildQuickAccess';
import { BRAND_LOGO } from '@/lib/brand';
import { useTranslation } from '@/lib/i18n';

import { useBoletim } from './Boletim.hook';

export default function Boletim() {
  const { t } = useTranslation();
  const boletim = useBoletim();
  const {
    monthLabel,
    isCurrentMonth,
    completedCount,
    stats,
    report,
    isGeneratingReport,
    reportFailure,
    isEmptyMonth,
    handlePreviousMonth,
    handleCurrentMonth,
    handleGenerateReport,
  } = boletim;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="px-6 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <img src={BRAND_LOGO} alt={t('common.brandLogoAlt')} className="w-12 h-12 rounded-xl" />
          <span className="text-blue-600 font-medium">{t('boletim.sectionLabel')}</span>
          <ChildQuickAccess />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">{t('boletim.title')}</h1>
        <p className="text-zinc-500 text-sm mt-1">{t('boletim.subtitle')}</p>
      </div>

      <div className="px-6 mb-6">
        <div className="flex items-center justify-between bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <button
            onClick={handlePreviousMonth}
            aria-label={t('boletim.previousMonth')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronLeft aria-hidden="true" className="w-5 h-5 text-zinc-400" />
          </button>
          <div className="text-center">
            <h2 className="font-medium text-zinc-100 capitalize">{monthLabel}</h2>
            <p className="text-xs text-zinc-500">{t('boletim.completedInMonth', { count: completedCount })}</p>
          </div>
          <button
            onClick={handleCurrentMonth}
            disabled={isCurrentMonth}
            aria-label={t('boletim.currentMonth')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30"
          >
            <ChevronRight aria-hidden="true" className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      <div className="px-6 mb-6">
        <BoletimQuickStats stats={stats} />
      </div>

      <BoletimCharts boletim={boletim} />

      <div className="px-6 mb-6">
        <Button
          onClick={handleGenerateReport}
          disabled={isGeneratingReport}
          className="w-full h-14 bg-gradient-to-r from-blue-500 to-amber-500 hover:from-blue-600 hover:to-amber-600 text-white font-medium"
        >
          {isGeneratingReport ? (
            <>
              <Loader2 aria-hidden="true" className="w-5 h-5 mr-2 animate-spin" />
              {t('boletim.generating')}
            </>
          ) : (
            <>
              <Award aria-hidden="true" className="w-5 h-5 mr-2" />
              {t('boletim.generate')}
            </>
          )}
        </Button>

        {reportFailure && (
          <p role="alert" className="text-sm text-red-600 mt-2">
            {reportFailure.message}
          </p>
        )}
      </div>

      {report && <BoletimReportCard report={report} />}
      {report?.bloqueado ? <PlanUpsell lock={PLAN_LOCKS.FULL_REPORT} /> : null}
      {report && <BoletimShare report={report} monthLabel={monthLabel} />}

      {!report && isEmptyMonth && (
        <div className="px-6">
          <div className="text-center py-12 bg-zinc-900 rounded-2xl border border-dashed border-zinc-800">
            <Award aria-hidden="true" className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">{t('boletim.emptyTitle')}</p>
            <p className="text-sm text-zinc-600 mt-1">{t('boletim.emptyBody')}</p>
          </div>
        </div>
      )}

      <BoletimQuickAccess />
    </div>
  );
}
