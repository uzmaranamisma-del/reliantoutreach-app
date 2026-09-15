ALTER TABLE `BackgroundJob` MODIFY `status` ENUM('pending','processing','completed','failed','retry','cancelled') NOT NULL DEFAULT 'pending';
