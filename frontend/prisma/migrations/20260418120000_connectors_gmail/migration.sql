-- CreateEnum
CREATE TYPE "ConnectorProvider" AS ENUM ('GMAIL');

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectorProvider" NOT NULL,
    "externalEmail" TEXT,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Connector_userId_provider_key" ON "Connector"("userId", "provider");

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
