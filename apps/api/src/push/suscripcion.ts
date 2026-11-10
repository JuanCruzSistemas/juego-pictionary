import { z } from 'zod';

/**
 * Servicios de push de los navegadores. La API va a mandar pedidos a `endpoint`: solo se aceptan
 * estos dominios, para que nadie pueda hacer que el servidor llame a una URL cualquiera.
 */
const SERVICIOS_DE_PUSH = [
  'fcm.googleapis.com', // Chrome y Android
  'android.googleapis.com',
  'updates.push.services.mozilla.com', // Firefox
  'push.services.mozilla.com',
  'web.push.apple.com', // Safari
  'push.apple.com',
  'notify.windows.com', // Edge en Windows
];

export function esServicioDePush(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    return SERVICIOS_DE_PUSH.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const base64url = (max: number, nombre: string) =>
  z
    .string({ error: `Falta la clave ${nombre}.` })
    .min(1, `Falta la clave ${nombre}.`)
    .max(max, `La clave ${nombre} es demasiado larga.`)
    .regex(/^[A-Za-z0-9_-]+=*$/, `La clave ${nombre} no es base64url.`);

const endpoint = z
  .string({ error: 'Falta el endpoint.' })
  .max(2048, 'El endpoint es demasiado largo.')
  .refine(esServicioDePush, 'El endpoint no es de un servicio de push conocido.');

/** El JSON de PushSubscription.toJSON(). */
export const suscripcionSchema = z.object({
  endpoint,
  expirationTime: z.number().nullable().optional(),
  keys: z.strictObject({ p256dh: base64url(200, 'p256dh'), auth: base64url(100, 'auth') }, { error: 'Faltan las claves.' }),
});

export const desuscripcionSchema = z.strictObject({ endpoint: z.string({ error: 'Falta el endpoint.' }).max(2048) });

export type SuscripcionValidada = z.infer<typeof suscripcionSchema>;
