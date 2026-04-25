export function getCycleLength(adminFeeDays: number) {
  return Math.max(2, adminFeeDays + 1);
}

export function getPlanTotalDays(durationMonths: number, cycleLength: number) {
  return durationMonths * cycleLength;
}

export function getCompletedCycles(startDate: Date, cycleLength: number, now: Date = new Date()) {
  const daysElapsed = Math.max(
    0,
    Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  return Math.floor(daysElapsed / cycleLength);
}

export function getProjectedAdminEarnings(durationMonths: number, dailyAmount: number) {
  return durationMonths * dailyAmount;
}

export function getProjectedUserPayout(durationMonths: number, dailyAmount: number, cycleLength: number) {
  return (durationMonths * cycleLength * dailyAmount) - getProjectedAdminEarnings(durationMonths, dailyAmount);
}
