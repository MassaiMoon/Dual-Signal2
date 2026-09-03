import { PrismaClient, IdentityTier, EventSource, AchievementType } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Seeding mock badge state...');

  // Create a test user
  const user = await db.user.upsert({
    where: { id: 'test-user-001' },
    update: {},
    create: {
      id: 'test-user-001',
    },
  });

  // Create a mock external account (Discord)
  const externalAccount = await db.externalAccount.upsert({
    where: { source_externalUserId: { source: EventSource.MOCK, externalUserId: 'mock-discord-001' } },
    update: {},
    create: {
      userId: user.id,
      source: EventSource.MOCK,
      externalUserId: 'mock-discord-001',
      handle: '@test-member',
      verifiedAt: new Date(),
    },
  });

  // Create the real badge — seeded with the live DUAL object minted on 2026-09-03
  const badge = await db.badge.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      dualObjectId:   '6a992ed66df5194a3695ac38',  // Genesis #001 — live on chain 6301
      dualTemplateId: '6a992c456df5194a3695ab9b',  // io.dual.signal.community-badge.v1
      identityTier: IdentityTier.BUILDER,
      isGenesis: true,
      isStakeholder: true,
      isGovernor: false,
      lastIntegrityHash: '0xbdd46aac643bd1a2cc69754e4a7c726acef81908906ff42ad13e56a02f1b64c6',
      discordHandle: '',
      telegramHandle: '',
      walletAddress: '0x2f86E417a3e225cFa7C4975533CBc3760A86215B',
      memberSince: '2026-09-03',
    },
  });

  // Seed achievement progress rows (all locked at 0)
  const achievements = Object.values(AchievementType);
  for (const achievementType of achievements) {
    await db.achievementProgress.upsert({
      where: { badgeId_achievementType: { badgeId: badge.id, achievementType } },
      update: {},
      create: {
        badgeId: badge.id,
        achievementType,
        progress: 0,
        level: 0,
      },
    });
  }

  console.log(`✓ User:             ${user.id}`);
  console.log(`✓ External account: ${externalAccount.id} (${externalAccount.handle})`);
  console.log(`✓ Badge:            ${badge.id} (${badge.identityTier})`);
  console.log(`✓ Achievements:     ${achievements.length} rows seeded (all locked)`);
  console.log('\nMock badge state ready. signal_count = 0, no achievements unlocked.');
  console.log('Use POST /api/admin/simulate-event to drive the first demo flow.');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
