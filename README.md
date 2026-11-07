# Garabato

Pictionary a distancia para dos. Ver `CLAUDE.md`, `docs/alcance.md` y `plan-etapa-1.md`.

## Desarrollo local

Requisitos: Node 24 o más nuevo, npm y Docker.

```sh
npm install
cp .env.example apps/api/.env
npm run db:up      # Postgres en localhost:5432
npm run db:migrate # aplica las migraciones
npm run db:seed    # carga la lista base de palabras
npm run dev:api    # API en localhost:3000
npm run dev:web    # Web en localhost:4200, también visible en la red local
```

Para probar en los celulares, conectalos al mismo Wi-Fi y abrí `http://<IP-de-la-compu>:4200`. La web pasa `/api` y `/health` a la API mediante el proxy de `ng serve`, así que no hace falta exponer el puerto 3000.

## Crear una sala

```sh
npm run crear-sala                                  # usa WEB_URL de apps/api/.env
npm run crear-sala -- --url http://192.168.0.10:4200  # link con la IP de la compu
```

El comando imprime el link `/s/<invitacion>`. Mandáselo a cada persona.

## Tests

```sh
npm test
```
