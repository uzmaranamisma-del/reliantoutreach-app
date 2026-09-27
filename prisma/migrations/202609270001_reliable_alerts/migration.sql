ALTER TABLE `PushSubscription` ADD COLUMN `sessionId` VARCHAR(191) NULL;
ALTER TABLE `PushSubscription` MODIFY `endpoint` VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE TABLE `NotificationRead` (
  `notificationId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`notificationId`, `userId`),
  CONSTRAINT `NotificationRead_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `PushDelivery` (
  `id` VARCHAR(64) NOT NULL,
  `subscriptionId` VARCHAR(191) NOT NULL,
  `payload` JSON NOT NULL,
  `permission` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `runAfter` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `lastError` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), INDEX `PushDelivery_status_runAfter_idx` (`status`, `runAfter`),
  CONSTRAINT `PushDelivery_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `PushSubscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ReplyScan` (
  `clientId` VARCHAR(191) NOT NULL,
  `enabledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `cursor` VARCHAR(1000) NULL,
  `lastScanAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastError` VARCHAR(191) NULL,
  PRIMARY KEY (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ReplyEvent` (
  `id` VARCHAR(64) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `queued` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), INDEX `ReplyEvent_queued_createdAt_idx` (`queued`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `PackageFeature` (`id`, `packageId`, `key`, `enabled`)
SELECT CONCAT('im_', `id`), `packageId`, 'inbox.manage', `enabled` FROM `PackageFeature` WHERE `key` = 'inbox.reply';
INSERT INTO `ClientPermissionOverride` (`id`, `clientId`, `key`, `enabled`)
SELECT CONCAT('im_', `id`), `clientId`, 'inbox.manage', `enabled` FROM `ClientPermissionOverride` WHERE `key` = 'inbox.reply';
