import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Seeding demo identity...');

  const user = await db.user.upsert({
    where: { username: 'DemoUser' },
    update: {},
    create: {
      id:                 'demouser-001',
      username:           'DemoUser',
      usernameNormalized: 'demouser',
    },
  });
  console.log('✓ User:            ', user.id, `(@${user.username})`);

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
      discordLevel:    0,
      governanceLevel: 0,
      xHandle:        '',
      telegramHandle: '',
      discordHandle:  '',
      memberSince:    '2026-09',
    },
  });
  console.log('✓ Badge:           ', badge.id, `(${badge.cachedTier}, score=${badge.signalScore})`);
  console.log('\nDemo identity ready.');
  console.log('Signal Score = 0, all tracks locked. No wallet required.');
  console.log('Use POST /api/admin/simulate-event to begin the demo flow.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
