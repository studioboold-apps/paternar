/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { Images } from 'lucide-react';

import AvatarPicker from '@/components/AvatarPicker';
import ChildFields from '@/components/ChildFields';
import ChildWizard from '@/components/ChildWizard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PlanUpsell from '@/components/PlanUpsell';
import { useTranslation } from '@/lib/i18n';

/**
 * Cadastrar e editar sao conversas diferentes: quem cadastra responde uma
 * pergunta por vez (`ChildWizard`); quem edita ja' conhece a ficha e quer ver
 * tudo junto — inclusive a foto e o historico/album, que moram aqui dentro.
 */
export default function ChildEditDialog({ perfil }) {
  const { t } = useTranslation();
  const {
    isChildDialogOpen,
    editingChild,
    childForm,
    childFailure,
    childPlanBlock,
    isSavingChild,
    canSaveChild,
    handleCloseChildDialog,
    handleChildFieldChange,
    handleSaveChild,
    handleOpenChildFiles,
  } = perfil;

  return (
    <Dialog open={isChildDialogOpen} onOpenChange={(open) => { if (!open) handleCloseChildDialog(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {editingChild ? t('perfil.childDialog.editTitle') : t('perfil.childDialog.addTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {editingChild ? t('perfil.childDialog.editTitle') : t('perfil.childDialog.addTitle')}
          </DialogDescription>
        </DialogHeader>

        {editingChild ? (
          <div className="space-y-5">
            <AvatarPicker
              name={childForm.name}
              value={childForm.avatar_url}
              onChange={(url) => handleChildFieldChange('avatar_url', url)}
              size="lg"
            />

            <ChildFields value={childForm} onFieldChange={handleChildFieldChange} />

            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChildFiles(editingChild)}
              className="w-full h-12 justify-start border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
            >
              <Images aria-hidden="true" className="w-4 h-4 mr-2 text-blue-600" />
              {t('perfil.childDialog.files', { child: editingChild.name })}
            </Button>

            {childFailure && (
              <p role="alert" className="text-sm text-red-600">
                {childFailure.message}
              </p>
            )}

            <Button
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-amber-500 hover:from-blue-600 hover:to-amber-600 text-white"
              onClick={handleSaveChild}
              disabled={!canSaveChild || isSavingChild}
            >
              {isSavingChild ? t('perfil.saving') : t('perfil.save')}
            </Button>
          </div>
        ) : childPlanBlock ? (
          <PlanUpsell {...childPlanBlock} />
        ) : (
          <ChildWizard
            value={childForm}
            onFieldChange={handleChildFieldChange}
            onFinish={handleSaveChild}
            onCancel={handleCloseChildDialog}
            isSaving={isSavingChild}
            failure={childFailure}
            finishLabel={t('perfil.save')}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
