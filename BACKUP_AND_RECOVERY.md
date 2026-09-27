# Backup and recovery

## Production verification — September 27, 2026

hPanel shows automated **Daily** backups, latest snapshot **2026-09-27 20:34** (panel display time), and next scheduled backup September 28. The app's **Files → Backups → Restore and download → Database backup** view lists `u366394665_reliantapp` in that snapshot. No production restore was performed; the local encrypted restore drill below remains the tested recovery exercise. Keep environment secrets separately backed up as described below.

## Encrypted export and isolated restore tooling

Run from a trusted machine with the official MySQL CLI installed and access to the database. Set `BACKUP_ENCRYPTION_KEY` to a separate 64-character random hex secret, kept in a password manager. `MYSQLDUMP_PATH` and `MYSQL_PATH` may contain absolute executable paths. No password is placed in process arguments or logs.

```sh
node scripts/backup.mjs create /secure-backups/outreach-YYYY-MM-DD.robackup
```

The export uses a consistent transaction, gzip and AES-256-GCM. SQL remains in memory; the output is encrypted. The tool refuses to overwrite an existing backup. Maximum uncompressed export size is 512 MiB; larger databases require a streaming/provider backup workflow. Schedule this command on a trusted always-on host or use Hostinger's managed database backups; the application HTTP cron does not run the export.

For a drill, create a NEW EMPTY database with a name ending in `_restore_test`, put its connection in `RESTORE_DATABASE_URL`, then run:

```sh
node scripts/backup.mjs restore-test /secure-backups/outreach-YYYY-MM-DD.robackup
```

Authentication of the encrypted archive completes before any SQL is restored. The tool rejects a populated target and the original database. Never attach an active mail/Manyreach worker to the restored database until queued external side effects are reconciled. A local fixture backup/restore drill was completed on September 27; production backup scheduling remains an account-level verification item.

## Back up before migrations

Use hPanel's backup facilities for the hosting account and export the application MySQL database separately through phpMyAdmin. Select the dedicated application database, choose Export, SQL format, and include structure and data. For a larger database, use the hosting provider's supported export process rather than an HTTP export that may time out.

Download the export to encrypted storage outside the public website directory. Record the export time, application Git commit, migration version and database name. Never commit an export to GitHub.

## Keep encryption keys with the recovery material

Back up the environment values in a password manager or encrypted secret store. `ENCRYPTION_KEY` is necessary to decrypt stored clientspace keys and pending job payloads. Losing it means those records cannot be recovered from MySQL alone. Keep AUTH_SECRET, SMTP and Manyreach credentials, database connection details and CRON_SECRET separately protected as well.

Do not change ENCRYPTION_KEY in place: a rotation requires a controlled re-encryption migration and will invalidate opaque resource links. A reset of AUTH_SECRET invalidates sessions; plan the resulting sign-ins. Rotate SMTP/provider credentials with corresponding application updates.

## Restore safely

1. Pause scheduled cron invocations and restrict user access during restoration.
2. Preserve a copy of the currently affected database before making any changes.
3. Restore the SQL export into a new dedicated MySQL database using phpMyAdmin Import or the supported hosting restore process.
4. Configure a private test deployment with the restored database and the matching encryption key. Confirm schema/migration versions and decrypt a mapping without printing its credential.
5. Restore the matching application revision. Do not run destructive schema reset commands.
6. Review pending/processing jobs before reconnecting external services. A database snapshot can roll back a completed job to pending while its external email/import already happened. Quarantine such jobs and reconcile with the actual Manyreach/SMTP result; do not blindly replay them.
7. Verify Superadmin login, client mappings, memberships, packages, invitation state and provider reads. Expired sessions/invites should remain expired.
8. Switch the managed app to the restored database during a planned maintenance window, verify HTTPS and release gates, and resume cron after job review.

MySQL restoration does **not** roll back Manyreach campaigns, replies, prospect imports or sent emails. Manyreach remains authoritative. Never use a database restore as a way to undo outreach.

## Routine retention

Check backup completion regularly and perform a restore rehearsal before relying on it. Verify what backup frequency and retention your specific Hostinger subscription includes. Application cron retention keeps metadata small but is not a substitute for backups. Monitor database growth and long-running queries in the hosting tools.
