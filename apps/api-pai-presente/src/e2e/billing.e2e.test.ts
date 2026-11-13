/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Pagamentos pela lib (`@adatechnology/payment-module`) contra o banco de
 * verdade, composto como o `main.ts` compoe: drizzle 0.4x com bun-sql, schema
 * `payment` da migration do pacote, o pai achado pela tabela `users` e o
 * painel lendo pelo mesmo modulo. Nada fala com a Hotmart: o webhook vem do
 * provedor falso.
 *
 * Roda com `PP_E2E=1` e as migrations aplicadas (`make migrate`).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { FAKE_PAYMENT_SECRET_HEADER } from '@adatechnology/payment-module/testing';

import { createDatabaseClient, type Database } from '../database/client';
import { authIdentitiesTable } from '../modules/Auth/auth.table';
import { buildBillingModule, type BillingModule } from '../modules/Billing/billing.module';
import { createPanelBillingRepository } from '../modules/Panel/panel-billing.repository';
import { usersTable } from '../modules/User/user.table';

const IS_ENABLED = Bun.env.PP_E2E === '1' && Boolean(Bun.env.DATABASE_URL);
const RUN_ID = randomUUID().slice(0, 8);
const SECRET = 'segredo-falso-de-teste';
const PARENT_ID = randomUUID();
const PARENT_EMAIL = `pai-${RUN_ID}@teste.dev`;
const GOOGLE_PARENT_ID = randomUUID();
const GOOGLE_EMAIL = `google-${RUN_ID}@teste.dev`;
const PASSWORD_PARENT_ID = randomUUID();
const PASSWORD_EMAIL = `senha-${RUN_ID}@teste.dev`;

describe.skipIf(!IS_ENABLED)('pagamentos pela lib (e2e em processo)', () => {
  let database: Database;
  let billing: BillingModule;

  async function call(method: string, path: string, init: { user?: string; body?: unknown; secret?: string } = {}) {
    const response = await billing.router.handle(
      new Request(`http://local/v1${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(init.user ? { cookie: `pai=${init.user}` } : {}),
          ...(init.secret ? { [FAKE_PAYMENT_SECRET_HEADER]: init.secret } : {}),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
    );
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as Record<string, any>) : undefined };
  }

  const webhook = (body: Record<string, unknown>, secret = SECRET) =>
    call('POST', '/payments/webhooks/fake', { body, secret });

  beforeAll(async () => {
    database = createDatabaseClient(Bun.env.DATABASE_URL ?? '');
    await database.insert(usersTable).values([
      { id: PARENT_ID, email: PARENT_EMAIL, fullName: 'Pai Pagante' },
      { id: GOOGLE_PARENT_ID, email: GOOGLE_EMAIL, fullName: 'Pai do Google' },
      { id: PASSWORD_PARENT_ID, email: PASSWORD_EMAIL, fullName: 'Pai da Senha' },
    ]);
    await database
      .insert(authIdentitiesTable)
      .values({ userId: GOOGLE_PARENT_ID, provider: 'google', subject: `google-${RUN_ID}` });

    const emails: Record<string, string> = {
      [PARENT_ID]: PARENT_EMAIL,
      [GOOGLE_PARENT_ID]: GOOGLE_EMAIL,
      [PASSWORD_PARENT_ID]: PASSWORD_EMAIL,
    };
    billing = buildBillingModule({
      database,
      config: {
        hotmart: {
          hottok: '',
          checkoutUrls: { monthly: 'https://pay.hotmart.com/A1?off=mensal01', yearly: '' },
        },
        fakeSecret: SECRET,
        isProduction: false,
      },
      authenticatedUserResolver: {
        async resolve(request) {
          const userId = request.headers.get('cookie')?.replace('pai=', '');
          return userId && emails[userId] ? { userId, email: emails[userId] } : undefined;
        },
      },
    });
  });

  afterAll(async () => {
    const ids = [PARENT_ID, GOOGLE_PARENT_ID, PASSWORD_PARENT_ID];
    await database.execute(sql`delete from payment.payment_events where external_id like ${`%-${RUN_ID}`}`);
    await database.execute(sql`delete from payment.subscriptions where external_id like ${`%-${RUN_ID}`}`);
    for (const id of ids) await database.execute(sql`delete from ${usersTable} where ${usersTable.id} = ${id}`);
  });

  test('sem assinatura o pai fica no gratuito, e o checkout ja leva o id dele', async () => {
    const me = await call('GET', '/payments/me', { user: PARENT_ID });
    expect(me.status).toBe(200);
    expect(me.body?.['data']).toMatchObject({ planCode: 'gratuito', status: 'none', hasAccess: false });

    const plans = await call('GET', '/payments/plans', { user: PARENT_ID });
    const monthly = plans.body?.['data'].find((plan: { code: string }) => plan.code === 'premium_mensal');
    const hotmart = monthly.checkouts.find((checkout: { provider: string }) => checkout.provider === 'hotmart');
    expect(new URL(hotmart.url).searchParams.get('xcod')).toBe(PARENT_ID);
    // E-mail de cadastro por senha nao vai no link: ele tambem amarraria compra alheia.
    expect(new URL(hotmart.url).searchParams.get('email')).toBeNull();

    const google = await call('GET', '/payments/plans', { user: GOOGLE_PARENT_ID });
    const googleMonthly = google.body?.['data'].find((plan: { code: string }) => plan.code === 'premium_mensal');
    expect(new URL(googleMonthly.checkouts[0].url).searchParams.get('email')).toBe(GOOGLE_EMAIL);
  });

  test('sem sessao e 401; webhook com segredo errado e 401; Hotmart sem hottok e 503', async () => {
    expect((await call('GET', '/payments/me')).status).toBe(401);
    expect((await webhook({ eventId: `x-${RUN_ID}`, type: 'payment_approved', occurredAt: new Date().toISOString() }, 'errado-errado-errado-')).status).toBe(401);
    expect((await call('POST', '/payments/webhooks/hotmart', { body: {} })).status).toBe(503);
  });

  test('compra aprovada libera o premium; o aviso repetido conta uma vez', async () => {
    const body = {
      eventId: `e1-${RUN_ID}`,
      type: 'payment_approved',
      occurredAt: new Date().toISOString(),
      subscriptionId: `s1-${RUN_ID}`,
      customerRef: PARENT_ID,
      email: PARENT_EMAIL,
      offerCode: 'mensal',
      paymentMethod: 'pix',
      amountCents: 1990,
      currency: 'BRL',
      periodEndsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };
    expect((await webhook(body)).status).toBe(200);
    expect((await webhook(body)).body?.['data']['duplicate']).toBe(true);

    const me = await call('GET', '/payments/me', { user: PARENT_ID });
    expect(me.body?.['data']).toMatchObject({ planCode: 'premium_mensal', status: 'active', hasAccess: true, paymentMethod: 'pix' });
  });

  test('compra feita antes da conta: amarra pelo e-mail so de quem entrou pelo Google', async () => {
    const at = new Date().toISOString();
    await webhook({ eventId: `e2-${RUN_ID}`, type: 'payment_approved', occurredAt: at, subscriptionId: `s2-${RUN_ID}`, email: GOOGLE_EMAIL, offerCode: 'anual' });
    await webhook({ eventId: `e3-${RUN_ID}`, type: 'payment_approved', occurredAt: at, subscriptionId: `s3-${RUN_ID}`, email: PASSWORD_EMAIL, offerCode: 'anual' });

    const google = await call('GET', '/payments/me', { user: GOOGLE_PARENT_ID });
    const password = await call('GET', '/payments/me', { user: PASSWORD_PARENT_ID });

    expect(google.body?.['data']).toMatchObject({ planCode: 'premium_anual', hasAccess: true });
    // E-mail de cadastro por senha nao e' confirmado: nao herda compra de ninguem.
    expect(password.body?.['data']).toMatchObject({ planCode: 'gratuito', hasAccess: false });
  });

  test('o painel le assinantes e eventos pelo mesmo modulo, com o pai ao lado', async () => {
    const panel = createPanelBillingRepository(database, billing.payments);

    const overview = await panel.overview();
    const subscribers = await panel.listSubscriptions({ page: 1, perPage: 20, search: 'pai pagante' });
    const events = await panel.listEvents({ page: 1, perPage: 50 });

    expect(overview.byStatus['active']).toBeGreaterThanOrEqual(3);
    expect(overview.unlinked).toBeGreaterThanOrEqual(1);
    expect(subscribers.rows).toHaveLength(1);
    expect(subscribers.rows[0]).toMatchObject({ planCode: 'premium_mensal', user: { id: PARENT_ID, name: 'Pai Pagante' } });
    expect(events.rows.some((row) => row.userId === PARENT_ID && row.amountCents === 1990)).toBe(true);
  });
});
