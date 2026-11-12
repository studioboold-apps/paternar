/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { CUSTOMER_MIGRATIONS_TABLE, customerMigrationsFolder } from '@adatechnology/customer-module';
import {
  NOTIFICATION_MIGRATIONS_TABLE,
  notificationMigrationsFolder,
} from '@adatechnology/notification-module';
import {
  RECOMMENDATION_MIGRATIONS_TABLE,
  recommendationMigrationsFolder,
} from '@adatechnology/recommendation-module';
import { USER_MIGRATIONS_TABLE, userMigrationsFolder } from '@adatechnology/user-module';

/**
 * Na imagem, o `bun build` fecha tudo num arquivo e o `__dirname` dos pacotes
 * deixa de apontar para a pasta deles. O Dockerfile copia cada
 * `dist/migrations` para `./sdk-migrations/<modulo>`; fora da imagem, vale a
 * pasta do proprio pacote.
 */
export const SDK_MIGRATIONS_DIRECTORY = './sdk-migrations';

export type SdkMigration = {
  readonly name: string;
  readonly folder: string;
  readonly table: string;
};

/** Ordem importa: o anunciante (customer) existe antes da recomendacao que aponta para ele. */
export function listSdkMigrations(directory: string = SDK_MIGRATIONS_DIRECTORY): SdkMigration[] {
  const modules = [
    { name: 'user-module', fallback: userMigrationsFolder, table: USER_MIGRATIONS_TABLE },
    { name: 'customer-module', fallback: customerMigrationsFolder, table: CUSTOMER_MIGRATIONS_TABLE },
    {
      name: 'recommendation-module',
      fallback: recommendationMigrationsFolder,
      table: RECOMMENDATION_MIGRATIONS_TABLE,
    },
    {
      name: 'notification-module',
      fallback: notificationMigrationsFolder,
      table: NOTIFICATION_MIGRATIONS_TABLE,
    },
  ];

  return modules.map((module) => {
    const bundled = join(directory, module.name);
    return { name: module.name, folder: existsSync(bundled) ? bundled : module.fallback(), table: module.table };
  });
}
