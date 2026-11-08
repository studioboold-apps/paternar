/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Denunciar um post ou comentario da comunidade. A denuncia vai para a fila
 * da equipe no painel; o pai nao ve quem mais denunciou, e o autor nao sabe
 * quem denunciou.
 */

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export const REPORT_REASONS = Object.freeze(['ofensivo', 'spam', 'golpe', 'inadequado', 'outro']);

/** @param {{ target: { type: 'post' | 'comment', id: string } | null, onClose: () => void }} props */
export default function ReportContentDialog({ target, onClose }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');

  const close = () => {
    setReason(null);
    setDetails('');
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.entities.CommunityReport.report(target, {
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      }),
    onSuccess: () => {
      toast({ title: t('community.report.sentTitle'), description: t('community.report.sentBody') });
      close();
    },
    onError: () => toast({ title: t('community.report.failed'), variant: 'destructive' }),
  });

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {target?.type === 'comment' ? t('community.report.titleComment') : t('community.report.titlePost')}
          </DialogTitle>
          <DialogDescription>{t('community.report.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('community.report.reasonLabel')}>
          {REPORT_REASONS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={reason === value}
              onClick={() => setReason(value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                reason === value
                  ? 'border-blue-500 bg-blue-500/10 text-blue-700'
                  : 'border-zinc-700 text-zinc-400 hover:text-zinc-200',
              )}
            >
              {t(`community.report.reasons.${value}`)}
            </button>
          ))}
        </div>
        <Textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={1000}
          placeholder={t('community.report.detailsPlaceholder')}
          className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {t('community.report.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={reason === null || mutation.isPending}>
            {t('community.report.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
