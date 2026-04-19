import { Request, Response } from 'express';
import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';

export class SettingsController {
  /**
   * GET /api/settings
   * Fetches global settings. Instantiates them if they don't exist yet.
   */
  static async getSettings(req: Request, res: Response): Promise<void> {
    try {
      let settings = await prisma.appSettings.findFirst();
      if (!settings) {
        settings = await prisma.appSettings.create({
          data: {} // Uses schema defaults
        });
      }
      res.status(200).json({ success: true, settings });
    } catch (error: any) {
      logger.error('Get settings error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * PATCH /api/settings
   * Admin updates settings.
   */
  static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      
      let settings = await prisma.appSettings.findFirst();
      
      if (!settings) {
        settings = await prisma.appSettings.create({ data: payload });
      } else {
        settings = await prisma.appSettings.update({
          where: { id: settings.id },
          data: payload,
        });
      }

      res.status(200).json({ success: true, settings });
    } catch (error: any) {
      logger.error('Update settings error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
