# Pictionary a distancia: alcance del proyecto

Nov 3, 2026 · @Juanchi

## Objetivo

Una PWA para Android donde dos personas juegan al Pictionary a distancia, por turnos o en vivo. También sirve para dejarse dibujos sin nada que adivinar.

El valor está en que es privada: palabras con chistes internos, historial de dibujos y notificaciones que mantienen el juego activo aunque no estén conectados al mismo tiempo.

## Alcance

La primera versión es para dos personas, con el modelo de datos basado en salas para no cerrar la puerta a más usuarios.

**Entra**

- Sala privada para dos, con acceso por link y sesión guardada en el dispositivo.
- Modo por turnos y modo en vivo, con las mismas reglas.
- Dibujos libres, sin nada que adivinar.
- Lista de palabras base y palabras propias.
- Respuesta en texto libre, tolerante a tildes y errores chicos.
- Pistas enviadas por la otra persona dentro de la app.
- Reproducción del dibujo trazo por trazo.
- Historial de dibujos.
- Racha compartida.
- Notificaciones push.

**Queda afuera por ahora**

- Registro abierto y grupos.
- Rankings y puntajes competitivos.
- Chat general.
- App nativa.

## Reglas del juego

Los turnos se alternan estrictamente y se premia jugar juntos, no competir.

| Tema | Regla |
| --- | --- |
| Palabra | El juego ofrece tres opciones, o quien dibuja escribe la suya. Con palabras propias, en la mitad de los turnos una de las tres es propia. |
| Turnos | Se alternan estrictamente, con un botón para saltear limitado a 3 usos por persona que se renuevan cada media hora. |
| Dibujos libres | Se pueden mandar sin nada que adivinar. |
| Adivinar | Intentos ilimitados. |
| Rendirse | Quien adivina puede tocar "Me rindo" (con confirmación): ve la palabra y pasa a dibujar, como con un acierto. No gasta salteos. |
| Pistas | Quien dibujó se las manda a quien adivina dentro de la app, sin límite, mientras adivina. Una pista no puede tener la palabra. |
| Progreso | Racha compartida, sin rankings. Se mantiene si al menos uno de los dos adivina en el día una palabra que dibujó el otro, contando los días en hora de Argentina. Rendirse no cuenta. |
| Modo en vivo | Se inicia con una invitación por notificación y las rondas no tienen límite de tiempo. |

## Plataforma y stack

Se construye como PWA, con Android como objetivo principal.

- **Front:** Angular y `@angular/pwa`, con Canvas y Pointer Events para dibujar con el dedo.
- **Back:** NestJS y PostgreSQL en Neon.
- **En vivo:** gateway de Socket.IO.
- **Notificaciones:** `SwPush` en el front y `web-push` en NestJS, sobre HTTPS.
- **Trazos:** se guardan como puntos, con `x` e `y` de 0 a 1 y `t` como tiempo desde el inicio del dibujo. Este mismo formato alimenta el guardado, la reproducción y el modo en vivo.

**Deploy:** front como sitio estático y backend como servicio web en el plan gratis de Render, con la base en el plan gratis de Neon. Un uptime bot llama cada menos de 15 minutos a un `/health` que no consulta la base.

```ts
type Stroke = {
  color: string;
  width: number;
  points: { x: number; y: number; t: number }[];
};
```

## Etapas de desarrollo

Con la etapa 1 ya se puede jugar; el resto se suma sobre esa base.

1. **Turnos:** sala por link, lienzo, guardado de trazos, palabras, adivinanza y botón para saltear.
2. **La gracia:** reproducción, pistas, dibujos libres, historial, palabras propias y racha.
3. **Notificaciones:** instalación como PWA y push, ya con el proyecto deployado en HTTPS.
4. **En vivo:** invitación, rondas sin límite de tiempo y trazos enviados en tiempo real.

## Pendientes de definir

Estas decisiones conviene cerrarlas antes de empezar a programar.

- [ ] ¿Se confirma que por ahora es solo para dos personas? Sí, confirmado.
- [ ] ¿Los 3 salteos son por persona, y se renuevan cada día, cada semana o nunca? Se renuevan cada media hora.
- [ ] ¿Las pistas son solo texto, y tienen un límite? Sín límite.
- [ ] ¿Qué mantiene viva la racha? Jugar por día, o adivinar más bien una palabra que dibujo el otro en el día.
- [ ] En vivo, ¿qué pasa si se terminan los 90 segundos sin acierto? Mejor quitemos eso de los 90 segundos sin acierto.
- [ ] ¿Dónde se va a deployar? Render free tier con uptime bot. Base de datos en Neon.
