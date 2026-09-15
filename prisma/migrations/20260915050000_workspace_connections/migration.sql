ALTER TABLE `ManyreachClientspace`
  ADD COLUMN `providerType` VARCHAR(20) NOT NULL DEFAULT 'clientspace',
  DROP INDEX `ManyreachClientspace_providerId_key`,
  ADD UNIQUE INDEX `ManyreachClientspace_providerType_providerId_key` (`providerType`, `providerId`);
