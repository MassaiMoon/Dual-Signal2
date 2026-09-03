/**
 * Badge update worker.
 *
 * Processes PENDING rows in badge_updates by calling PATCH /objects/:id on DUAL.
 * In production, call this on a schedule (cron) or trigger it after each event.
 * For MVP: call runPendingUpdates() at the end of the webhook handler once
 * M5 (real DUAL integration) is wired in.
 *
 * Never runs concurrent DUAL writes — processes one row at a time to respect
 * per-account nonce ordering.
 */

import { db } from './db';
import { objects } from './dual-client';
import { UpdateStatus } from '@prisma/client';

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [1_000, 5_000, 15_000, 30_000, 60_000];

export async function runPendingUpdates(): Promise<void> {
  const pending = await db.badgeUpdate.findMany({
    where: { status: UpdateStatus.PENDING, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    include: { badge: true },
    take: 10, // process in small batches
  });

  for (const update of pending) {
    await db.badgeUpdate.update({
      where: { id: update.id },
      data: { status: UpdateStatus.PROCESSING, attempts: { increment: 1 } },
    });

    try {
      const customState = update.requestedState as Record<string, string>;

      // M5: swap MOCK check for real DUAL object ID
      if (update.badge.dualObjectId === 'MOCK-OBJECT-ID') {
        console.log('[update-worker] MOCK mode — skipping DUAL API call');
        console.log('[update-worker] Would write:', customState);
        await db.badgeUpdate.update({
          where: { id: update.id },
          data: { status: UpdateStatus.COMPLETED, dualActionId: 'MOCK' },
        });
        continue;
      }

      const updated = await objects.update(update.badge.dualObjectId, customState);

      await db.$transaction([
        db.badgeUpdate.update({
          where: { id: update.id },
          data: { status: UpdateStatus.COMPLETED, dualActionId: updated.integrity_hash },
        }),
        db.badge.update({
          where: { id: update.badge.id },
          data: { lastIntegrityHash: updated.integrity_hash },
        }),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const nextStatus = update.attempts + 1 >= MAX_ATTEMPTS ? UpdateStatus.FAILED : UpdateStatus.PENDING;

      await db.badgeUpdate.update({
        where: { id: update.id },
        data: { status: nextStatus, errorMessage: msg },
      });

      console.error(`[update-worker] Failed (attempt ${update.attempts + 1}): ${msg}`);
    }
  }
}
