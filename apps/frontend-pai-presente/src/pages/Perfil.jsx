/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Facebook, Instagram, LogOut, Pencil, User } from 'lucide-react';

import ChildDeleteDialog from '@/components/ChildDeleteDialog';
import AvatarPicker from '@/components/AvatarPicker';
import ChildEditDialog from '@/components/ChildEditDialog';
import ChildFilesDialog from '@/components/ChildFilesDialog';
import FamilyValuesSection from '@/components/FamilyValuesSection';
import LanguagePicker from '@/components/LanguagePicker';
import PerfilChildrenSection from '@/components/PerfilChildrenSection';
import PerfilNotificationSection from '@/components/PerfilNotificationSection';
import PerfilPlanSection from '@/components/PerfilPlanSection';
import ProfileEditDialog from '@/components/ProfileEditDialog';
import { Button } from '@/components/ui/button';
import { BRAND_LOGO, BRAND_SOCIAL_LINKS } from '@/lib/brand';
import { useTranslation } from '@/lib/i18n';

import { usePerfil } from './Perfil.hook';

const SOCIAL_LINKS = [
  { key: 'instagram', href: BRAND_SOCIAL_LINKS.INSTAGRAM, Icon: Instagram },
  { key: 'facebook', href: BRAND_SOCIAL_LINKS.FACEBOOK, Icon: Facebook },
];

const STAT_CARD = 'bg-zinc-900 rounded-2xl p-4 text-center border border-zinc-800';

export default function Perfil() {
  const { t } = useTranslation();
  const perfil = usePerfil();
  const {
    user,
    averageGrade,
    completedActivities,
    handleOpenEditProfile,
    handleLogout,
    childForFiles,
    handleCloseChildFiles,
    handleChangeAvatar,
    isSavingAvatar,
    avatarFailure,
  } = perfil;

  const stats = [
    { key: 'children', labelKey: 'perfil.stats.children', value: perfil.children.length, tone: 'text-zinc-100' },
    { key: 'activities', labelKey: 'perfil.stats.activities', value: completedActivities, tone: 'text-emerald-600' },
    {
      key: 'average',
      labelKey: 'perfil.stats.average',
      value: averageGrade === undefined ? t('perfil.stats.noAverage') : `${averageGrade}⭐`,
      tone: 'text-blue-600',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="px-6 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <img src={BRAND_LOGO} alt={t('common.brandLogoAlt')} className="w-12 h-12 rounded-xl" />
          <div className="flex flex-col leading-tight">
            <span className="text-blue-600 font-medium">{t('common.brandName')}</span>
            <span className="text-zinc-500 text-xs uppercase tracking-wider">{t('common.brandTagline')}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AvatarPicker
            name={user?.full_name ?? t('perfil.fallbackInitial')}
            value={user?.avatar_url ?? null}
            onChange={handleChangeAvatar}
            size="lg"
            showActions={false}
            isBusy={isSavingAvatar}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-zinc-100">{user?.full_name ?? t('perfil.fallbackName')}</h1>
            <p className="text-zinc-500 text-sm truncate">{user?.email}</p>
          </div>
        </div>
        {avatarFailure && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {avatarFailure.message}
          </p>
        )}
      </div>

      <div className="px-4 mb-8">
        <div className="grid grid-cols-3 gap-3">
          {stats.map(({ key, labelKey, value, tone }, index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={STAT_CARD}
            >
              <p className={`text-2xl font-bold ${tone}`}>{value}</p>
              <p className="text-xs text-zinc-500 mt-1">{t(labelKey)}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-zinc-100 flex items-center gap-2">
              <User aria-hidden="true" className="w-5 h-5 text-zinc-400" />
              {t('perfil.profileSection.title')}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('perfil.profileSection.edit')}
              onClick={handleOpenEditProfile}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <Pencil aria-hidden="true" className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('perfil.profileSection.age')}</span>
              <span className="text-zinc-300">
                {user?.age ? t('perfil.profileSection.ageValue', { age: user.age }) : t('perfil.emptyValue')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('perfil.profileSection.maritalStatus')}</span>
              <span className="text-zinc-300">
                {user?.marital_status ? t(`profile.maritalStatus.${user.marital_status}`) : t('perfil.emptyValue')}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">{t('profile.city.label')}</span>
              <span className="text-zinc-300 truncate">{user?.city ?? t('perfil.emptyValue')}</span>
            </div>
          </div>
        </div>
      </div>

      <PerfilPlanSection />

      <PerfilChildrenSection perfil={perfil} />

      <PerfilNotificationSection />

      <FamilyValuesSection />

      <LanguagePicker />

      <div className="px-4 mt-8">
        <Button
          variant="outline"
          className="w-full bg-transparent border-red-900/50 text-red-600 hover:bg-red-900/20"
          onClick={handleLogout}
        >
          <LogOut aria-hidden="true" className="w-4 h-4 mr-2" />
          {t('perfil.logout')}
        </Button>
      </div>

      <div className="px-4 mt-8 pb-8 text-center">
        <p className="text-sm text-zinc-500">{t('perfil.social.title')}</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          {SOCIAL_LINKS.map(({ key, href, Icon }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t(`perfil.social.${key}`)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 transition-colors hover:border-blue-600 hover:text-blue-600"
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
            </a>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-zinc-600">
          <img src={BRAND_LOGO} alt={t('common.brandLogoAlt')} className="w-6 h-6 rounded-md opacity-50" />
          <span className="text-sm">{t('common.brandName')}</span>
        </div>
      </div>

      <ProfileEditDialog perfil={perfil} />
      <ChildEditDialog perfil={perfil} />
      <ChildFilesDialog child={childForFiles} onClose={handleCloseChildFiles} />
      <ChildDeleteDialog perfil={perfil} />
    </div>
  );
}
