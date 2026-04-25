import prisma from "../utils/prisma";

export interface RuntimeBusinessSettings {
  adminFeeDays: number;
  allowSignup: boolean;
  notificationsEnabled: boolean;
  appName: string;
  primaryColor: string;
  secondaryColor: string;
}

const DEFAULT_ADMIN_FEE_DAYS = 30;

export class AppSettingsService {
  static async getOrCreateSettings() {
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {},
      });
    }

    return settings;
  }

  static async getRuntimeBusinessSettings(): Promise<RuntimeBusinessSettings> {
    const settings = await this.getOrCreateSettings();

    return {
      adminFeeDays: this.normalizeAdminFeeDays(settings.adminFeeDays),
      allowSignup: settings.allowSignup,
      notificationsEnabled: settings.notificationsEnabled,
      appName: settings.appName,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
    };
  }

  static normalizeAdminFeeDays(value?: number | null) {
    if (!Number.isFinite(value)) {
      return DEFAULT_ADMIN_FEE_DAYS;
    }

    return Math.max(1, Math.floor(value as number));
  }
}
