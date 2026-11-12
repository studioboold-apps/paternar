/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, CheckCircle, Tent, BookOpen, Dumbbell, Palette, TreePine, ChefHat, Gamepad2, School, GraduationCap, Wrench } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { toLocalDate } from '@/lib/calendar-date';
import AddToCalendarMenu from '@/components/AddToCalendarMenu';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import RatingButton from '@/components/ui/RatingButton';

const categoryConfig = {
  aventura: { icon: Tent, color: 'text-blue-600', bg: 'bg-blue-400/10 border-blue-400/20' },
  educativa: { icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  esportiva: { icon: Dumbbell, color: 'text-teal-600', bg: 'bg-teal-400/10 border-teal-400/20' },
  criativa: { icon: Palette, color: 'text-sky-600', bg: 'bg-sky-400/10 border-sky-400/20' },
  natureza: { icon: TreePine, color: 'text-emerald-600', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  culinaria: { icon: ChefHat, color: 'text-blue-600', bg: 'bg-blue-300/10 border-blue-300/20' },
  jogos: { icon: Gamepad2, color: 'text-teal-600', bg: 'bg-teal-300/10 border-teal-300/20' },
  escolar: { icon: School, color: 'text-indigo-600', bg: 'bg-indigo-400/10 border-indigo-400/20' },
  cursos: { icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-400/10 border-purple-400/20' },
  oficinas: { icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-400/10 border-orange-400/20' }
};

export default function ActivityCard({ 
  activity, 
  onComplete, 
  onRate,
  delay = 0 
}) {
  /**
   * O dia da atividade e dia de calendario. Lido por `new Date`, ele virava
   * meia-noite em Greenwich e, a oeste dela, caia no dia anterior — o cartao
   * do dia 10 dizia "9 de set" e ja nascia passado.
   *
   * E a comparacao e DIA contra DIA: contra o instante de agora, a atividade
   * marcada para hoje a tarde vira passada logo depois da meia-noite.
   */
  const { t, dateLocale } = useTranslation();
  const activityDay = toLocalDate(activity.date);
  const isPast = activityDay.getTime() < startOfDay(new Date()).getTime();
  const config = categoryConfig[activity.category] || categoryConfig.aventura;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn(
        "rounded-2xl p-4 border transition-all",
        config.bg,
        activity.completed && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2.5 rounded-xl bg-zinc-900/50", config.color)}>
          <Icon aria-hidden="true" className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {activity.is_suggested && (
              <span className="text-[10px] px-2 py-0.5 bg-blue-400/20 text-blue-600 rounded-full font-medium">
                {t('activityCard.suggested')}
              </span>
            )}
            {activity.completed && (
              <span className="text-[10px] px-2 py-0.5 bg-emerald-400/20 text-emerald-600 rounded-full font-medium flex items-center gap-1">
                <CheckCircle aria-hidden="true" className="w-3 h-3" /> {t('activityCard.completed')}
              </span>
            )}
          </div>

          <h4 className="font-medium text-zinc-100 mb-1">
            {activity.title}
          </h4>

          {activity.description && (
            <p className="text-sm text-zinc-400 mb-2 line-clamp-2">
              {activity.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Calendar aria-hidden="true" className="w-3.5 h-3.5" />
              {format(activityDay, t('common.dateFormats.dayMonth'), { locale: dateLocale })}
            </span>
            {activity.time && (
              <span className="flex items-center gap-1">
                <Clock aria-hidden="true" className="w-3.5 h-3.5" />
                {activity.time}
              </span>
            )}
            {activity.child_name && (
              <span className="flex items-center gap-1">
                <User aria-hidden="true" className="w-3.5 h-3.5" />
                {activity.child_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/50">
        {!activity.completed && isPast ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onComplete(activity)}
            className="text-emerald-600 border-emerald-400/30 hover:bg-emerald-400/10 bg-transparent"
          >
            <CheckCircle aria-hidden="true" className="w-4 h-4 mr-1" />
            {t('activityCard.markCompleted')}
          </Button>
        ) : !activity.completed ? (
          <AddToCalendarMenu activity={activity} label={t('activityCard.addToCalendar')} />
        ) : (
          <div />
        )}

        {activity.completed && (
          <RatingButton
            currentRating={activity.rating}
            onRate={(r) => onRate(activity.id, r)}
          />
        )}
      </div>
    </motion.div>
  );
}