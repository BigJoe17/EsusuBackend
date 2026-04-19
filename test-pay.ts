import { PrismaClient } from '@prisma/client';
import { ContributionService } from './src/modules/contribution/contribution.service';

const prisma = new PrismaClient();

async function main() {
  const plan = await prisma.savingsPlan.findFirst({
    include: { user: true }
  });
  
  if (!plan) {
    console.log("No plan found");
    return;
  }
  
  console.log("Paying 5 days for plan", plan.id, "Daily amount:", plan.dailyAmount);
  
  try {
    const res = await ContributionService.payContribution(plan.userId, plan.id, {
      amount: plan.dailyAmount * 5,
      method: "TRANSFER"
    });
    console.log("Success:", res);
  } catch(e: any) {
    console.error("Failed:", e.message);
  }
}

main().finally(() => prisma.$disconnect());
