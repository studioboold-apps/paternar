/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, HelpCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import AdSlot from '@/components/AdSlot';
import AiBadge from '@/components/AiBadge';
import PlanUpsell from '@/components/PlanUpsell';
import { PLAN_LOCKS } from '@/lib/use-plan';
import InsightCard from '@/components/InsightCard';
import NotificationInbox from '@/components/NotificationInbox';
import PlacesToGo from '@/components/PlacesToGo';
import ChildQuickAccess from '@/components/ChildQuickAccess';
import BrandLoader from '@/components/BrandLoader';
import { BRAND_LOGO } from '@/lib/brand';
import { useTranslation } from '@/lib/i18n';
import { INSIGHT_CATEGORIES, findInsightCategory } from '@/lib/insight-categories';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';

import { useHome } from './Home.hook';

const GREETING_NAME_SLOT = '{name}';

export default function Home() {
  const { t } = useTranslation();
  const {
    activeCategory,
    filteredInsights,
    ratings,
    rateFailure,
    insightsFailure,
    insightsLocked,
    isLoadingInsights,
    hasChildren,
    firstName,
    handleCategoryClick,
    handleRate,
    handleRefresh,
  } = useHome();

  /**
   * O nome sai em negrito no meio da saudacao. Partir a frase pelo proprio
   * marcador mantem a ordem nas maos de quem traduz — em alemao o vocativo nao
   * fica onde ficou aqui — sem exigir duas chaves ("Ola," e o resto), que e' o
   * jeito classico de entregar ao tradutor meia frase sem contexto.
   */
  const [greetingBefore, greetingAfter] = t('home.greeting').split(GREETING_NAME_SLOT);
  const displayName = firstName ?? t('home.fallbackFirstName');

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="px-6 pt-10 pb-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-4">
            <img src={BRAND_LOGO} alt={t('common.brandLogoAlt')} className="w-12 h-12 rounded-xl" />
            <div className="flex flex-col leading-tight">
              <span className="text-blue-600 font-medium">{t('common.brandName')}</span>
              <span className="text-zinc-500 text-xs uppercase tracking-wider">{t('common.brandTagline')}</span>
            </div>
            {/* O sininho fica ao lado do atalho dos filhos, no canto que o design reservou para acesso rapido. */}
            <div className="ml-auto flex items-center gap-2">
              <NotificationInbox />
              <ChildQuickAccess className="ml-0" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">
            {greetingBefore}
            <span className="font-medium">{displayName}</span>
            {greetingAfter}
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">{t('home.subtitle')}</p>
        </motion.div>
      </div>

      <div className="px-6 mb-8">
        <div className="grid grid-cols-3 gap-3">
          {INSIGHT_CATEGORIES.map((category, index) => {
            const isActive = activeCategory === category.id;
            return (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  'aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border transition-all duration-300',
                  isActive
                    ? `bg-gradient-to-br ${category.gradient} border-blue-400/50`
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700',
                )}
              >
                <category.icon
                  aria-hidden="true"
                  className={cn('w-8 h-8', isActive ? 'text-emerald-600' : 'text-zinc-400')}
                />
                <span className={cn('text-xs text-center leading-tight', isActive ? 'text-zinc-100' : 'text-zinc-500')}>
                  {t(category.labelKey)}
                </span>
              </motion.button>
            );
          })}

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            onClick={handleRefresh}
            disabled={isLoadingInsights}
            className="aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all"
          >
            <RefreshCw aria-hidden="true" className={cn('w-8 h-8 text-zinc-400', isLoadingInsights && 'animate-spin')} />
            <span className="text-xs text-zinc-500">{t('insights.refresh')}</span>
          </motion.button>
        </div>
      </div>

      <div className="px-6 mb-8">
        <h3 className="text-zinc-100 font-medium mb-4">{t('home.quickAccess')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link to={createPageUrl('Juntinhos')}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-2xl p-4 flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Calendar aria-hidden="true" className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-zinc-100 text-sm font-medium">{t('home.shortcuts.juntinhos.title')}</span>
              <span className="text-zinc-500 text-xs text-center">{t('home.shortcuts.juntinhos.subtitle')}</span>
            </motion.div>
          </Link>

          <Link to={createPageUrl('Chat')}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col items-center gap-2"
            >
              <div className="relative w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <HelpCircle aria-hidden="true" className="w-6 h-6 text-emerald-600" />
                <AiBadge />
              </div>
              <span className="text-zinc-100 text-sm font-medium">{t('home.shortcuts.chat.title')}</span>
              <span className="text-zinc-500 text-xs text-center">{t('home.shortcuts.chat.subtitle')}</span>
            </motion.div>
          </Link>
        </div>
      </div>

      <div className="px-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
          {activeCategory ? t(findInsightCategory(activeCategory)?.labelKey) : t('insights.all')}
        </h2>

        {rateFailure && (
          <p role="alert" className="text-sm text-red-600 mb-4">
            {rateFailure.message}
          </p>
        )}

        {isLoadingInsights ? (
          <BrandLoader label={t('insights.generating')} className="py-16" />
        ) : insightsFailure ? (
          <p role="alert" className="text-center py-16 text-red-600">
            {insightsFailure.message}
          </p>
        ) : filteredInsights.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500">{hasChildren ? t('insights.empty') : t('insights.needsChildren')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInsights.map((insight, index) => (
              <InsightCard
                key={insight.id}
                {...insight}
                rating={ratings[insight.id]}
                onRate={handleRate}
                delay={index * 0.1}
              />
            ))}
            {insightsLocked ? <PlanUpsell lock={PLAN_LOCKS.FULL_REPORT} /> : null}
          </div>
        )}
      </div>

      <PlacesToGo className="px-6 mb-6" />

      <AdSlot className="px-6" />
    </div>
  );
}
