/**
 * Badge update worker.
 *
 * Processes PENDING rows in badge_updates by posting to the DUAL Event Bus.
 * Never runs concurrent DUAL writes — processes one row at a time to respect
 * per-account nonce ordering.
 */

import { db } from './db';
import { ebus } from './dual-client';
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

      const result = await ebus.execute({
        update: {
          id:   update.badge.dualObjectId,
          data: { custom: customState },
        },
      });

      await db.$transaction([
        db.badgeUpdate.update({
          where: { id: update.id },
          data: { status: UpdateStatus.COMPLETED, dualActionId: result.action_id },
        }),
        db.badge.update({
          where: { id: update.badge.id },
          data: { lastIntegrityHash: result.action_id },
        }),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // "object not owned by wallet" is permanent — object was transferred, never retry
      const permanent = msg.includes('object not owned by wallet');
      const nextStatus = permanent || update.attempts + 1 >= MAX_ATTEMPTS
        ? UpdateStatus.FAILED
        : UpdateStatus.PENDING;

      await db.badgeUpdate.update({
        where: { id: update.id },
        data: { status: nextStatus, errorMessage: msg },
      });

      console.error(`[update-worker] Failed (attempt ${update.attempts + 1})${permanent ? ' [permanent - transferred]' : ''}: ${msg}`);
    }
  }
}
