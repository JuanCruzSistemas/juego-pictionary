-- Etapa 2: pistas. Solo crea una tabla nueva.

-- CreateTable
CREATE TABLE "pistas" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pistas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pistas_turnoId_creadoEn_idx" ON "pistas"("turnoId", "creadoEn");

-- AddForeignKey
ALTER TABLE "pistas" ADD CONSTRAINT "pistas_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pistas" ADD CONSTRAINT "pistas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
