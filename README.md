# Garabato

Pictionary a distancia para dos. Ver `CLAUDE.md`, `docs/alcance.md` y `plan-etapa-1.md`.

## Desarrollo local

Requisitos: Node 24 o más nuevo, npm y Docker.

```sh
npm install
npm run db:up      # Postgres en localhost:5432
npm run dev:api    # API en localhost:3000
npm run dev:web    # Web en localhost:4200, también visible en la red local
```

Para probar en los celulares, conectalos al mismo Wi-Fi y abrí `http://<IP-de-la-compu>:4200`. La web pasa `/api` y `/health` a la API mediante el proxy de `ng serve`, así que no hace falta exponer el puerto 3000.

## Tests

```sh
npm test
```
