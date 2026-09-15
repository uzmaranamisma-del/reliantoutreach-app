CREATE TABLE `ConversationMeta` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `fromEmail` VARCHAR(320) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    `tags` JSON NULL,
    `notes` TEXT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConversationMeta_clientId_fromEmail_key`(`clientId`, `fromEmail`),
    INDEX `ConversationMeta_clientId_updatedAt_idx`(`clientId`, `updatedAt`),
    CONSTRAINT `ConversationMeta_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
