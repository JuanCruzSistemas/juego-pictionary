-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('eligiendo', 'dibujando', 'adivinando', 'adivinado', 'salteado');

-- CreateEnum
CREATE TYPE "OrigenPalabra" AS ENUM ('sugerida', 'propia');

-- CreateTable
CREATE TABLE "salas" (
    "id" TEXT NOT NULL,
    "invitacion" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jugadores" (
    "id" TEXT NOT NULL,
    "salaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "lugar" INTEGER NOT NULL,
    "sesionHash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jugadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "salaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "dibujaId" TEXT NOT NULL,
    "adivinaId" TEXT NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'eligiendo',
    "opciones" TEXT[],
    "palabra" TEXT,
    "palabraNormalizada" TEXT,
    "origen" "OrigenPalabra",
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMP(3),
    "adivinadoEn" TIMESTAMP(3),

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dibujos" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT,
    "autorId" TEXT NOT NULL,
    "trazos" JSONB NOT NULL,
    "duracionMs" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dibujos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentos" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "correcto" BOOLEAN NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salteos" (
    "id" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salteos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "palabras" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "salaId" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "palabras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salas_invitacion_key" ON "salas"("invitacion");

-- CreateIndex
CREATE UNIQUE INDEX "jugadores_sesionHash_key" ON "jugadores"("sesionHash");

-- CreateIndex
CREATE UNIQUE INDEX "jugadores_salaId_lugar_key" ON "jugadores"("salaId", "lugar");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_salaId_numero_key" ON "turnos"("salaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "dibujos_turnoId_key" ON "dibujos"("turnoId");

-- CreateIndex
CREATE INDEX "intentos_turnoId_creadoEn_idx" ON "intentos"("turnoId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "salteos_turnoId_key" ON "salteos"("turnoId");

-- CreateIndex
CREATE INDEX "salteos_jugadorId_creadoEn_idx" ON "salteos"("jugadorId", "creadoEn");

-- CreateIndex
CREATE INDEX "palabras_salaId_idx" ON "palabras"("salaId");

-- AddForeignKey
ALTER TABLE "jugadores" ADD CONSTRAINT "jugadores_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "salas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "salas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_dibujaId_fkey" FOREIGN KEY ("dibujaId") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_adivinaId_fkey" FOREIGN KEY ("adivinaId") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dibujos" ADD CONSTRAINT "dibujos_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dibujos" ADD CONSTRAINT "dibujos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos" ADD CONSTRAINT "intentos_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos" ADD CONSTRAINT "intentos_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salteos" ADD CONSTRAINT "salteos_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salteos" ADD CONSTRAINT "salteos_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "palabras" ADD CONSTRAINT "palabras_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "salas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
