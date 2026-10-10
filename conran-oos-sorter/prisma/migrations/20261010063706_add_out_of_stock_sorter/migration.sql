-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "liveMode" BOOLEAN NOT NULL DEFAULT false,
    "pinTag" TEXT NOT NULL DEFAULT 'oos-keep-position',
    "restoreManualPositions" BOOLEAN NOT NULL DEFAULT true,
    "fullSweepIntervalHours" INTEGER NOT NULL DEFAULT 6,
    "lastFullSweepAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CollectionState" (
    "shop" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "baseSort" TEXT,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "dirty" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "dirtySince" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dirtyVersion" INTEGER NOT NULL DEFAULT 0,
    "productCount" INTEGER,
    "outOfStockCount" INTEGER,
    "lastMoves" INTEGER,
    "lastRunLive" BOOLEAN,
    "lastSortedAt" DATETIME,
    "lastError" TEXT,
    "manualMemory" TEXT,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("shop", "collectionId")
);

-- CreateTable
CREATE TABLE "ProductStock" (
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("shop", "productId")
);

-- CreateTable
CREATE TABLE "PendingCheck" (
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("shop", "key")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "collectionId" TEXT,
    "title" TEXT,
    "kind" TEXT NOT NULL,
    "moves" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkerLock" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CollectionState_shop_dirty_priority_dirtySince_idx" ON "CollectionState"("shop", "dirty", "priority", "dirtySince");

-- CreateIndex
CREATE INDEX "PendingCheck_shop_createdAt_idx" ON "PendingCheck"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_shop_createdAt_idx" ON "ActivityLog"("shop", "createdAt");
