/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { NotificationModule } from '@adatechnology/notification-module';
import { NOTIFICATION_COMPANY_ID } from '../Notification/notification.constant';
import type { ChildOwnershipPort } from '../shared/child-ownership.interface';
import { ERROR_CODES } from '../shared/errors/codes';
import { ResourceNotFoundError, ResourceNotOwnedError } from '../shared/errors/shared.error';
import type {
  ActivityRepository,
  ActivityView,
  CreateActivityParams,
  FindActivityParams,
  ListActivitiesParams,
  ListActivitiesResult,
  UpdateActivityParams,
} from './types/activity.types';

function activityNotFound(): never {
  throw new ResourceNotFoundError(
    ERROR_CODES.activity.ACTIVITY_NOT_FOUND,
    'Atividade nao encontrada.',
  );
}

export type ActivityUseCases = {
  list(params: ListActivitiesParams): Promise<ListActivitiesResult>;
  getById(params: FindActivityParams): Promise<ActivityView>;
  create(params: CreateActivityParams): Promise<ActivityView>;
  update(params: UpdateActivityParams): Promise<ActivityView>;
  remove(params: FindActivityParams): Promise<void>;
};

export type CreateActivityUseCasesParams = {
  readonly repository: ActivityRepository;
  readonly childOwnership: ChildOwnershipPort;
  readonly notifications?: NotificationModule | undefined;
  readonly companyId?: string | undefined;
};

export function createActivityUseCases(params: CreateActivityUseCasesParams): ActivityUseCases {
  const { repository, childOwnership, notifications } = params;
  const companyId = params.companyId ?? NOTIFICATION_COMPANY_ID;

  /** Sem isto, um id de filho alheio entraria numa atividade propria (BOLA). */
  async function assertChildIsOwned(childId: string | undefined, userId: string): Promise<void> {
    if (childId === undefined) return;
    const isOwned = await childOwnership.isOwnedByUser({ childId, userId });
    if (isOwned) return;
    throw new ResourceNotOwnedError(
      ERROR_CODES.activity.ACTIVITY_CHILD_NOT_OWNED,
      'O filho informado nao pertence a este usuario.',
    );
  }

  return {
    list: (listParams) => repository.list(listParams),

    async getById(findParams) {
      const activity = await repository.findById(findParams);
      return activity ?? activityNotFound();
    },

    async create({ userId, values }) {
      await assertChildIsOwned(values.childId, userId);
      const activity = await repository.insert({ ...values, userId });

      if (notifications) {
        const startsAt = values.activityTime
          ? `${values.activityDate}T${values.activityTime}:00`
          : `${values.activityDate}T09:00:00`;

        // 1. Notificação imediata de agendamento na Inbox com metadados para calendário
        notifications.useCases.sendNotification
          .execute({
            companyId,
            recipientUserId: userId,
            category: 'atividades',
            templateKey: 'atividade_agendada',
            payload: {
              title: values.title,
              description: values.description ?? '',
              activityDate: values.activityDate,
              activityTime: values.activityTime ? ` às ${values.activityTime}` : '',
              calendarEvent: {
                title: values.title,
                description: values.description ?? undefined,
                startsAt,
              },
            },
          })
          .catch(() => {});

        // 2. Lembrete antecipado se no futuro
        const targetDate = new Date(startsAt);
        const now = new Date();
        const reminderDate = values.activityTime
          ? new Date(targetDate.getTime() - 60 * 60 * 1000)
          : new Date(`${values.activityDate}T08:00:00`);

        if (reminderDate > now) {
          notifications.useCases.sendNotification
            .execute({
              companyId,
              recipientUserId: userId,
              category: 'atividades',
              templateKey: 'atividade_lembrete',
              scheduledFor: reminderDate,
              payload: {
                title: values.title,
                description: values.description ?? '',
                activityDate: values.activityDate,
                activityTime: values.activityTime ? ` às ${values.activityTime}` : '',
                calendarEvent: {
                  title: values.title,
                  description: values.description ?? undefined,
                  startsAt,
                },
              },
            })
            .catch(() => {});
        }
      }

      return activity;
    },

    async update(updateParams) {
      await assertChildIsOwned(updateParams.values.childId, updateParams.userId);
      const activity = await repository.update(updateParams);
      if (!activity) activityNotFound();

      if (notifications && updateParams.values.isCompleted === true) {
        notifications.useCases.sendNotification
          .execute({
            companyId,
            recipientUserId: updateParams.userId,
            category: 'atividades',
            templateKey: 'atividade_concluida',
            payload: {
              title: activity.title,
              description: activity.description ?? '',
              activityDate: activity.activityDate,
            },
          })
          .catch(() => {});
      }

      return activity;
    },

    async remove(findParams) {
      const wasRemoved = await repository.remove(findParams);
      if (!wasRemoved) activityNotFound();
    },
  };
}
