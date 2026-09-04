import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Seeding badge state...');

  const user = await db.user.upsert({
    where: { id: 'test-user-001' },
    update: {},
    create: { id: 'test-user-001' },
  });
  console.log('✓ User:            ', user.id);

  const account = await db.externalAccount.upsert({
    where: { source_externalUserId: { source: 'MOCK', externalUserId: 'mock-tg-001' } },
    update: {},
    create: {
      userId:        user.id,
      source:        'MOCK',
      externalUserId:'mock-tg-001',
      handle:        '@test-member',
    },
  });
  console.log('✓ External account:', account.id, account.handle);

  const badge = await db.badge.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId:         user.id,
      dualObjectId:   '6a992ed66df5194a3695ac38',
      dualTemplateId: '6a992c456df5194a3695ab9b',
      signalScore:    0,
      cachedTier:     'INITIATE',
      xSignalLevel:    0,
      telegramLevel:   0,
      governanceLevel: 0,
      holderLevel:     0,
      lastIntegrityHash: '0xbdd46aac643bd1a2cc69754e4a7c726acef81908906ff42ad13e56a02f1b64c6',
      walletAddress: '0x2f86E417a3e225cFa7C4975533CBc3760A86215B',
      memberSince:   '2026-09-03',
    },
  });
  console.log('✓ Badge:           ', badge.id, `(${badge.cachedTier}, score=${badge.signalScore})`);
  console.log('\nGenesis #001 badge state ready.');
  console.log('Signal Score = 0, all tracks locked.');
  console.log('Use POST /api/admin/simulate-event to begin the demo flow.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
