import prisma from './src/utils/prisma';
import { ContributionService } from './src/modules/contribution/contribution.service';
import { PlanService } from './src/modules/plan/plan.service';

async function main() {
  const user = await prisma.user.findFirst();
  if(!user) return console.log("no user");

  let plan = await prisma.savingsPlan.findFirst({ where: { userId: user.id } });
  if(!plan) {
    console.log("creating plan");
    plan = await PlanService.createPlan(user.id, { dailyAmount: 1000, durationMonths: 1 });
  }
  
  console.log("Daily amount:", plan.dailyAmount);
  
  try {
    const res = await ContributionService.payContribution(user.id, plan.id, {
      amount: plan.dailyAmount * 3,
      method: 'TRANSFER'
    });
    console.log("Paid OK:", res.daysPaid, "batchId:", res.batchId);
    
    const sched = await PlanService.getPlanSchedule(plan.id);
    const pendings = sched.schedule.filter((s:any) => s.status === 'PENDING').length;
    console.log("Pending in schedule:", pendings);
  } catch(e:any) {
    console.log("Error:", e.message);
  }
}
main().finally(() => prisma.$disconnect());
