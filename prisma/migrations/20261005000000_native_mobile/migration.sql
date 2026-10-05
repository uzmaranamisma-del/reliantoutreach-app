-- AlterTable
ALTER TABLE `ReplyEvent` ADD COLUMN `conversationEmail` VARCHAR(254) NULL;

-- CreateTable
CREATE TABLE `NativeDevice` (
    `id` VARCHAR(191) NOT NULL,
    `installationId` VARCHAR(36) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(10) NOT NULL,
    `replies` BOOLEAN NOT NULL DEFAULT true,
    `orders` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NativeDevice_installationId_key`(`installationId`),
    UNIQUE INDEX `NativeDevice_token_key`(`token`),
    INDEX `NativeDevice_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NativePushDelivery` (
    `id` VARCHAR(64) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `kind` VARCHAR(10) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `runAfter` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `receiptId` VARCHAR(100) NULL,
    `lastError` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NativePushDelivery_status_runAfter_idx`(`status`, `runAfter`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MobileConversation` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `starred` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `MobileConversation_clientId_userId_email_key`(`clientId`, `userId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackageRequest` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `packageName` VARCHAR(191) NOT NULL,
    `price` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `setupPrice` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(36) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending_review',
    `notificationPending` BOOLEAN NOT NULL DEFAULT false,
    `note` TEXT NULL,
    `history` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PackageRequest_clientId_createdAt_idx`(`clientId`, `createdAt`),
    UNIQUE INDEX `PackageRequest_clientId_requestKey_key`(`clientId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NativeDevice` ADD CONSTRAINT `NativeDevice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NativeDevice` ADD CONSTRAINT `NativeDevice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NativeDevice` ADD CONSTRAINT `NativeDevice_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NativePushDelivery` ADD CONSTRAINT `NativePushDelivery_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `NativeDevice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MobileConversation` ADD CONSTRAINT `MobileConversation_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageRequest` ADD CONSTRAINT `PackageRequest_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
