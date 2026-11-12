/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { Calendar as CalendarIcon, Loader2, Plus } from 'lucide-react';

import AiIcon from '@/components/AiIcon';
import ActivityCard from '@/components/ActivityCard';
import ActivitySuggestionsDialog from '@/components/ActivitySuggestionsDialog';
import JuntinhosCalendar from '@/components/JuntinhosCalendar';
import NewActivityDialog from '@/components/NewActivityDialog';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';
import { Button } from '@/components/ui/button';
import ChildQuickAccess from '@/components/ChildQuickAccess';
import { BRAND_LOGO } from '@/lib/brand';
import { useTranslation } from '@/lib/i18n';

import { useJuntinhos } from './Juntinhos.hook';

export default function Juntinhos() {
  const { t } = useTranslation();
  const juntinhos = useJuntinhos();
  const {
    selectedDateLabel,
    activitiesForSelectedDate,
    screenFailure,
    isGeneratingSuggestions,
    canSuggest,
    handleComplete,
    handleRate,
    handleGenerateSuggestions,
    handleOpenNewActivity,
  } = juntinhos;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="px-6 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <img src={BRAND_LOGO} alt={t('common.brandLogoAlt')} className="w-12 h-12 rounded-xl" />
          <span className="text-blue-600 font-medium">{t('juntinhos.sectionLabel')}</span>
          <ChildQuickAccess />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">{t('juntinhos.title')}</h1>
        <p className="text-zinc-500 text-sm mt-1">{t('juntinhos.subtitle')}</p>
      </div>

      <div className="px-4 mb-4">
        <NotificationPermissionBanner />
      </div>

      <div className="px-4 mb-6">
        <JuntinhosCalendar juntinhos={juntinhos} />
      </div>

      <div className="px-4 mb-6">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleGenerateSuggestions}
            disabled={isGeneratingSuggestions || !canSuggest}
            className="flex-1 h-12 bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            {isGeneratingSuggestions ? (
              <Loader2 aria-hidden="true" className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <AiIcon aria-hidden="true" className="w-5 h-5 mr-2 text-blue-600" />
            )}
            {t('juntinhos.suggest')}
          </Button>
          <Button
            onClick={handleOpenNewActivity}
            className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-amber-500 hover:from-blue-600 hover:to-amber-600 text-white"
          >
            <Plus aria-hidden="true" className="w-5 h-5 mr-2" />
            {t('juntinhos.newActivity')}
          </Button>
        </div>

        {screenFailure && (
          <p role="alert" className="text-sm text-red-600 mt-3">
            {screenFailure.message}
          </p>
        )}
      </div>

      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-zinc-100">{selectedDateLabel}</h3>
            <p className="text-sm text-zinc-500">
              {t('juntinhos.activityCount', { count: activitiesForSelectedDate.length })}
            </p>
          </div>
        </div>

        {activitiesForSelectedDate.length === 0 ? (
          <div className="text-center py-12 bg-zinc-900 rounded-2xl border border-dashed border-zinc-800">
            <CalendarIcon aria-hidden="true" className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">{t('juntinhos.emptyTitle')}</p>
            <p className="text-sm text-zinc-600 mt-1">{t('juntinhos.emptyBody')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activitiesForSelectedDate.map((activity, index) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onComplete={handleComplete}
                onRate={handleRate}
                delay={index * 0.1}
              />
            ))}
          </div>
        )}
      </div>

      <NewActivityDialog juntinhos={juntinhos} />
      <ActivitySuggestionsDialog juntinhos={juntinhos} />
    </div>
  );
}
