/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Users } from 'lucide-react';

import AiIcon from '@/components/AiIcon';
import AdSlot from '@/components/AdSlot';
import CommunityCreatePost from '@/components/CommunityCreatePost';
import CommunityPostCard from '@/components/CommunityPostCard';
import PlanUpsell from '@/components/PlanUpsell';
import { PLAN_LOCKS } from '@/lib/use-plan';
import InsightCard from '@/components/InsightCard';
import ChildQuickAccess from '@/components/ChildQuickAccess';
import BrandLoader from '@/components/BrandLoader';
import { BRAND_LOGO } from '@/lib/brand';
import { useTranslation } from '@/lib/i18n';
import { INSIGHT_CATEGORIES, findInsightCategory } from '@/lib/insight-categories';
import { cn } from '@/lib/utils';

import { COMMUNITY_TABS, useComunidade } from './Comunidade.hook';

const TAB_STYLE = {
  active: 'bg-gradient-to-r from-blue-500 to-amber-500 text-white',
  idle: 'text-zinc-400 hover:text-zinc-200',
};

export default function Comunidade() {
  const { t } = useTranslation();
  const {
    activeTab,
    activeCategory,
    posts,
    insights,
    ratings,
    insightsFailure,
    insightsLocked,
    isLoadingInsights,
    hasChildren,
    handleTabChange,
    handleCategoryClick,
    handleRate,
    handleRefresh,
  } = useComunidade();

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="px-6 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <img src={BRAND_LOGO} alt={t('common.brandLogoAlt')} className="w-12 h-12 rounded-xl" />
          <span className="text-blue-600 font-medium">{t('comunidade.sectionLabel')}</span>
          <ChildQuickAccess />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">{t('comunidade.title')}</h1>
        <p className="text-zinc-500 text-sm mt-1">{t('comunidade.subtitle')}</p>
      </div>

      <div className="px-6 mb-6">
        <div className="flex gap-2 bg-zinc-900 rounded-2xl p-1.5 border border-zinc-800">
          <button
            onClick={() => handleTabChange(COMMUNITY_TABS.FEED)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === COMMUNITY_TABS.FEED ? TAB_STYLE.active : TAB_STYLE.idle,
            )}
          >
            <Users aria-hidden="true" className="w-4 h-4" />
            {t('comunidade.tabs.feed')}
          </button>
          <button
            onClick={() => handleTabChange(COMMUNITY_TABS.INSIGHTS)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === COMMUNITY_TABS.INSIGHTS ? TAB_STYLE.active : TAB_STYLE.idle,
            )}
          >
            <AiIcon aria-hidden="true" className="w-4 h-4" />
            {t('comunidade.tabs.insights')}
          </button>
        </div>
      </div>

      {activeTab === COMMUNITY_TABS.FEED && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 space-y-4">
          <CommunityCreatePost />

          {posts.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900 rounded-2xl border border-dashed border-zinc-800">
              <Users aria-hidden="true" className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">{t('comunidade.emptyFeedTitle')}</p>
              <p className="text-sm text-zinc-600 mt-1">{t('comunidade.emptyFeedBody')}</p>
            </div>
          ) : (
            posts.map((post, index) => <CommunityPostCard key={post.id} post={post} delay={index * 0.05} />)
          )}

          <AdSlot />
        </motion.div>
      )}

      {activeTab === COMMUNITY_TABS.INSIGHTS && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="px-6 mb-6">
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
                transition={{ delay: 0.3 }}
                onClick={handleRefresh}
                disabled={isLoadingInsights}
                className="aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn('w-8 h-8 text-zinc-400', isLoadingInsights && 'animate-spin')}
                />
                <span className="text-xs text-zinc-500">{t('insights.refresh')}</span>
              </motion.button>
            </div>
          </div>

          <div className="px-6">
            <h2 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
              {activeCategory ? t(findInsightCategory(activeCategory)?.labelKey) : t('insights.all')}
            </h2>

            {isLoadingInsights ? (
              <BrandLoader label={t('insights.generating')} className="py-16" />
            ) : insightsFailure ? (
              <div className="text-center py-16">
                <p role="alert" className="text-sm text-red-600">
                  {insightsFailure.message}
                </p>
              </div>
            ) : insights.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-zinc-500">{hasChildren ? t('insights.empty') : t('insights.needsChildren')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {insights.map((insight, index) => (
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
        </motion.div>
      )}
    </div>
  );
}
