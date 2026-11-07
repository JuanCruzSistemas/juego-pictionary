# Garabato: Pictionary a distancia para dos

PWA para Android donde dos personas juegan al Pictionary por turnos o en vivo, y se dejan dibujos libres.

## Documentación

- `docs/alcance.md`: alcance, reglas del juego, stack, deploy y etapas. Es la fuente de verdad de las reglas.
- `docs/diseno/`: una pantalla por archivo `.dc.html`, para celular de 390 × 844 px. `Sistema.dc.html` tiene colores, tipografías y componentes.

### Cómo leer los diseños

Los `.dc.html` son referencias visuales, no código para copiar ni ejecutar:

- Usan etiquetas propias de la herramienta de diseño: `<x-dc>`, `<helmet>`, `<sc-for>`, `<sc-if>` y huecos `{{valor}}`. Traducilos a componentes Angular, `@for`, `@if` y bindings.
- Respetá los estilos en línea: colores, tamaños, bordes, radios, sombras y espaciados.
- Los enlaces `href="Otra.dc.html"` indican la navegación entre pantallas.
- Los dibujos SVG del lienzo y las miniaturas son ilustraciones; en la app se dibujan con Canvas a partir de los trazos guardados.
- "Ella", las palabras, los intentos y las rachas son datos de ejemplo. "[Chiste interno N]" son espacios para palabras reales.

### Mapa de pantallas

| Archivo | Pantalla | Etapa |
| --- | --- | --- |
| `Bienvenida.dc.html` | Entrada por link y permiso de avisos | 1 (avisos en 3) |
| `Main.dc.html` | Inicio con tres estados: dibujar, adivinar, esperar | 1 |
| `Elegir.dc.html` | Elegir entre tres palabras o escribir una, y saltear | 1 |
| `Lienzo.dc.html` | Dibujar | 1 |
| `Adivinar.dc.html` | Ver el dibujo, pistas e intentos | 1 (reproducción y pistas en 2) |
| `Acierto.dc.html` | Acierto | 1 |
| `Seguimiento.dc.html` | Ver intentos y mandar pistas | 2 |
| `Recibido.dc.html` | Dibujo libre recibido | 2 |
| `Libre.dc.html` | Hacer un dibujo libre | 2 |
| `Historial.dc.html` | Historial | 2 |
| `Palabras.dc.html` | Palabras propias | 2 |
| `Avisos.dc.html` | Textos de las notificaciones | 3 |
| `VivoEspera.dc.html`, `VivoDibuja.dc.html`, `VivoAdivina.dc.html` | Modo en vivo | 4 |

## Stack

- Monorepo: `apps/web` en Angular con `@angular/pwa`, y `apps/api` en NestJS.
- PostgreSQL: local con `docker-compose`, Neon en producción.
- Trazos con `x` e `y` normalizadas de 0 a 1 y `t` en milisegundos desde el inicio del dibujo:

```ts
type Stroke = {
  color: string;
  width: number;
  points: { x: number; y: number; t: number }[];
};
```

- Estilos: los colores y tipografías de `Sistema.dc.html` como variables CSS globales desde el principio. Fuentes: Shantell Sans para títulos y botones, Figtree para el texto.

## Forma de trabajar

- Antes de programar una etapa, proponé un plan corto y esperá aprobación.
- Avanzá de a una pantalla o módulo por vez, y dejá cada paso funcionando.
- No agregues funciones que no estén en `docs/alcance.md`.
