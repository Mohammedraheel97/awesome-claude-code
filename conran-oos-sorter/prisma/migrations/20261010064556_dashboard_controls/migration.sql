-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "lastTickAt" DATETIME;
ALTER TABLE "ShopSettings" ADD COLUMN "pausedUntil" DATETIME;
ALTER TABLE "ShopSettings" ADD COLUMN "restoreAllStatus" TEXT;

-- CreateTable
CREATE TABLE "DailyStats" (
    "shop" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "productsMoved" INTEGER NOT NULL DEFAULT 0,
    "collectionsSorted" INTEGER NOT NULL DEFAULT 0,
    "products" INTEGER,
    "outOfStock" INTEGER,

    PRIMARY KEY ("shop", "day")
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CollectionState" (
    "shop" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "baseSort" TEXT,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "restoreRequested" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_CollectionState" ("baseSort", "collectionId", "dirty", "dirtySince", "dirtyVersion", "excluded", "handle", "lastError", "lastMoves", "lastRunLive", "lastSortedAt", "manualMemory", "outOfStockCount", "priority", "productCount", "shop", "title", "updatedAt") SELECT "baseSort", "collectionId", "dirty", "dirtySince", "dirtyVersion", "excluded", "handle", "lastError", "lastMoves", "lastRunLive", "lastSortedAt", "manualMemory", "outOfStockCount", "priority", "productCount", "shop", "title", "updatedAt" FROM "CollectionState";
DROP TABLE "CollectionState";
ALTER TABLE "new_CollectionState" RENAME TO "CollectionState";
CREATE INDEX "CollectionState_shop_dirty_priority_dirtySince_idx" ON "CollectionState"("shop", "dirty", "priority", "dirtySince");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
