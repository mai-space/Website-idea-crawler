import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Mai Space',
      plan: 'pro',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@sitebrief.dev' },
    update: {},
    create: {
      orgId: org.id,
      email: 'admin@sitebrief.dev',
      passwordHash: await bcrypt.hash('password123', 10),
      name: 'Joel Mai',
      role: 'admin',
    },
  });

  await prisma.site.createMany({
    skipDuplicates: true,
    data: [
      {
        orgId: org.id,
        name: 'Acme Corp',
        url: 'https://example.com',
        cms: 'typo3',
        priority: 8,
        status: 'idle',
      },
      {
        orgId: org.id,
        name: 'Client B',
        url: 'https://clientb.example.com',
        cms: 'wordpress',
        priority: 5,
        status: 'idle',
      },
    ],
  });

  console.log('Seed complete — admin@sitebrief.dev / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
