/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { z } from 'zod';

import { LLM_PROVIDERS } from '../modules/Ai/ai.constant';
import { BACKUP_DESTINATIONS } from '../modules/Backup/backup.constant';
import { DEFAULT_PRESIGN_TTL_SECONDS, MEDIA_DESTINATIONS } from '../modules/Media/media.constant';

type EnvironmentSource = Record<string, string | undefined>;

const runtimeShape = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
} as const;

const databaseShape = {
  DATABASE_URL: z.string().min(1),
} as const;

const httpShape = {
  API_PORT: z.coerce.number().default(3000),
  /** Origens do navegador, separadas por virgula. */
  WEB_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
} as const;

const authShape = {
  /** Assina o token de acesso. Menos de 32 caracteres nao e segredo, e chave. */
  AUTH_JWT_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().default(''),
  APPLE_CLIENT_ID: z.string().default(''),
  /**
   * Login de desenvolvimento. Explicito por design: ausencia de OAuth NAO pode
   * ligar isto sozinho, senao a producao mal configurada abriria a porta.
   */
  AUTH_DEV_SIGN_IN: z
    .enum(['0', '1'])
    .default('0')
    .transform((value) => value === '1'),
  /**
   * Entrada por e-mail e senha. Ligada por padrao, ao contrario do login de
   * desenvolvimento: aquilo e porta dos fundos, isto e o produto. Desligar e
   * decisao explicita de quem so quer OAuth.
   */
  AUTH_PASSWORD_SIGN_IN: z
    .enum(['0', '1'])
    .default('1')
    .transform((value) => value === '1'),
} as const;

const aiShape = {
  /**
   * Provedor de IA. Sem default silencioso: subir com o provedor errado gasta
   * dinheiro na conta errada, e o erro so apareceria na primeira pergunta.
   */
  LLM_PROVIDER: z.enum(LLM_PROVIDERS),
  /**
   * Chave do provedor. So no servidor — nunca com prefixo `VITE_`. Vazia e
   * ESTADO valido: quem pedir texto recebe 503 legivel (`LlmNotConfiguredError`),
   * e o resto do produto sobe. Exigir aqui matava a API inteira no boot.
   */
  LLM_API_KEY: z.string().default(''),
  /** Modelo do chat e do boletim. Vazio usa o padrao do provedor (`DEFAULT_MODELS`). */
  LLM_MODEL: z.string().default(''),
  /** Modelo barato de insights e sugestoes. Vazio usa o padrao do provedor. */
  LLM_MODEL_FAST: z.string().default(''),
  /**
   * Chave do Groq para transcrever o audio do chat pelo pacote da casa
   * (`@adatechnology/audio-transcription-provider`) — a Anthropic nao ouve
   * audio. Mesmo nome usado nos outros produtos. Vazia e' estado valido: so'
   * o microfone responde 503.
   */
  TRANSCRIPTION_GROQ_API_KEY: z.string().default(''),
  /** Vazio usa o padrao do pacote (`whisper-large-v3-turbo`). */
  TRANSCRIPTION_MODEL: z.string().default(''),
} as const;

const backupShape = {
  /**
   * 32 bytes em base64. Vazia e ESTADO valido para quem nunca vai fazer backup
   * (a maquina de desenvolvimento), e morre em voz alta no job — a alternativa,
   * exigir aqui, mataria a API inteira no boot por causa de uma tarefa noturna.
   */
  BACKUP_ENCRYPTION_KEY: z.string().default(''),
  BACKUP_DESTINATION: z
    .enum([BACKUP_DESTINATIONS.FILESYSTEM, BACKUP_DESTINATIONS.S3])
    .default(BACKUP_DESTINATIONS.FILESYSTEM),
  BACKUP_DIRECTORY: z.string().default('.backups'),
  BACKUP_S3_BUCKET: z.string().default(''),
  BACKUP_S3_ENDPOINT: z.string().default(''),
  /** Entra no NOME do objeto: separa o balde de staging do de producao. */
  BACKUP_ENVIRONMENT: z.string().default('dev'),
  /**
   * Para onde o restore escreve. Vazio significa "de volta no mesmo banco", que
   * e' o caso do incidente; a PROVA aponta para um banco descartavel, porque
   * ensaiar restauracao por cima do banco vivo e' o ensaio que ninguem faz.
   */
  RESTORE_DATABASE_URL: z.string().default(''),
} as const;

const mediaShape = {
  MEDIA_DESTINATION: z
    .enum([MEDIA_DESTINATIONS.FILESYSTEM, MEDIA_DESTINATIONS.S3])
    .default(MEDIA_DESTINATIONS.FILESYSTEM),
  MEDIA_DIRECTORY: z.string().default('.media'),
  MEDIA_S3_BUCKET: z.string().default(''),
  MEDIA_S3_ENDPOINT: z.string().default(''),
  /**
   * Base64 de 32 bytes. Vazia por padrao seguindo o `LLM_API_KEY`: exigir no
   * boot mataria a API inteira por falta de uma chave que so o exame usa. Quem
   * tentar guardar exame sem ela recebe 503 `MEDIA_KEY_INVALID` — ver
   * `Media/media-cipher.ts`.
   */
  MEDIA_ENCRYPTION_KEY: z.string().default(''),
  /** Vida do link da foto. Curta por design — ver `DEFAULT_PRESIGN_TTL_SECONDS`. */
  MEDIA_PRESIGN_TTL_SECONDS: z.coerce.number().default(DEFAULT_PRESIGN_TTL_SECONDS),
} as const;

const panelShape = {
  /**
   * Assina a sessao da EQUIPE no painel (`@adatechnology/user-module`). Segredo
   * proprio, separado de `AUTH_JWT_SECRET`: token de pai nunca abre o painel, e
   * vazar um nao entrega o outro. Vazio e estado valido: o painel nao e montado,
   * e `/v1/panel/*` responde 404 como qualquer rota que nao existe.
   */
  PANEL_JWT_SECRET: z
    .string()
    .default('')
    .refine((value) => value === '' || value.length >= 32, 'PANEL_JWT_SECRET precisa de 32+ caracteres'),
  /**
   * Primeiro acesso da equipe. No boot, se ninguem com este e-mail existir no
   * painel, ele e criado como `admin`. Depois disso as variaveis podem sair: a
   * senha so vale na primeira criacao, nunca sobrescreve a atual.
   */
  PANEL_ADMIN_EMAIL: z.string().default(''),
  // Sem `refine` de proposito: senha curta aqui derrubava a API inteira (pais
  // inclusive). Quem recusa senha curta, com log, e' o `ensureFirstAdmin`.
  PANEL_ADMIN_PASSWORD: z.string().default(''),
  /**
   * Recuperacao de acesso. Com `1`, o boot grava `PANEL_ADMIN_PASSWORD` como a
   * senha atual de `PANEL_ADMIN_EMAIL` (e reativa a conta como admin). Serve
   * para quando ninguem mais entra no painel; depois do login, volte para `0`.
   */
  // Ligado por padrao: a senha de `PANEL_ADMIN_PASSWORD` vale para os e-mails de
  // `PANEL_ADMIN_EMAIL` a cada boot. `0` desliga (senha passa a ser so do painel).
  // Tolerante: aceita 1/true/sim, com ou sem aspas; valor errado nao derruba a API.
  PANEL_ADMIN_RESET: z
    .string()
    .default('1')
    .transform((value) => ['1', 'true', 'sim', 'yes'].includes(value.trim().replace(/^["']|["']$/g, '').toLowerCase())),
} as const;

const databaseEnvironmentSchema = z.object({ ...runtimeShape, ...databaseShape });
const backupEnvironmentSchema = z.object({
  ...runtimeShape,
  ...databaseShape,
  ...backupShape,
});
const aiEnvironmentSchema = z.object({ ...runtimeShape, ...aiShape });
const seedEnvironmentSchema = z.object({
  ...runtimeShape,
  ...databaseShape,
  AUTH_JWT_SECRET: authShape.AUTH_JWT_SECRET,
});
const environmentSchema = z.object({
  ...runtimeShape,
  ...databaseShape,
  ...httpShape,
  ...authShape,
  ...aiShape,
  ...mediaShape,
  ...panelShape,
});

export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;
export type BackupEnvironment = z.infer<typeof backupEnvironmentSchema>;
export type AiEnvironment = z.infer<typeof aiEnvironmentSchema>;
export type SeedEnvironment = z.infer<typeof seedEnvironmentSchema>;
export type Environment = z.infer<typeof environmentSchema>;

/**
 * Um schema unico para o processo inteiro faz cada tarefa carregar as exigencias
 * de todas as outras: a migration morria por falta de chave de IA, e criar
 * tabela nao gera texto nenhum. Cada entrada le so a fatia que usa.
 */
export function readDatabaseEnvironment(
  source: EnvironmentSource = process.env,
): DatabaseEnvironment {
  return databaseEnvironmentSchema.parse(source);
}

/** O job de backup fala com o banco e com o balde, e nada mais. */
export function readBackupEnvironment(
  source: EnvironmentSource = process.env,
): BackupEnvironment {
  return backupEnvironmentSchema.parse(source);
}

export function readAiEnvironment(
  source: EnvironmentSource = process.env,
): AiEnvironment {
  return aiEnvironmentSchema.parse(source);
}

/**
 * O seed entra pelo login de desenvolvimento e por isso assina token — dai o
 * segredo. Nao le `AUTH_DEV_SIGN_IN`: quem semeia JA decidiu semear, e ligar o
 * provedor de desenvolvimento em producao morre no registro de verificadores.
 */
export function readSeedEnvironment(source: EnvironmentSource = process.env): SeedEnvironment {
  return seedEnvironmentSchema.parse(source);
}

/** O boot do servidor precisa de tudo, e falha antes de aceitar a primeira chamada. */
export function readEnvironment(source: EnvironmentSource = process.env): Environment {
  return environmentSchema.parse(source);
}
