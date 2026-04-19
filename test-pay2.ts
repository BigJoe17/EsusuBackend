import { PrismaClient } from '@prisma/client';
import { ContributionService } from './src/modules/contribution/contribution.service';

const prisma = new PrismaClient();

async function main() {
  const plan = await prisma.savingsPlan.findFirst();
  if (!plan) return console.log('no plan');
  
  console.log("Found plan daily amount:", plan.dailyAmount, "Status:", plan.status);
  
  const contribs = await prisma.contribution.findMany({ where: { planId: plan.id }});
  console.log("Contributions:", contribs.map(c => c.status).slice(0, 5));
  
  try {
    const res = await ContributionService.payContribution(plan.userId, plan.id, {
      amount: plan.dailyAmount * 4,
      method: 'CASH'
    });
    console.log("Success payment:", res);
  } catch(e:any) {
    console.log("Error:", e.message);
  }
}
main().finally(() => prisma.$disconnect());
