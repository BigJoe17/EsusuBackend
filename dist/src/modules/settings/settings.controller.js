"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const logger_1 = require("../../utils/logger");
class SettingsController {
    /**
     * GET /api/settings
     * Fetches global settings. Instantiates them if they don't exist yet.
     */
    static async getSettings(req, res) {
        try {
            let settings = await prisma_1.default.appSettings.findFirst();
            if (!settings) {
                settings = await prisma_1.default.appSettings.create({
                    data: {} // Uses schema defaults
                });
            }
            res.status(200).json({ success: true, settings });
        }
        catch (error) {
            logger_1.logger.error('Get settings error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
    /**
     * PATCH /api/settings
     * Admin updates settings.
     */
    static async updateSettings(req, res) {
        try {
            const payload = req.body;
            let settings = await prisma_1.default.appSettings.findFirst();
            if (!settings) {
                settings = await prisma_1.default.appSettings.create({ data: payload });
            }
            else {
                settings = await prisma_1.default.appSettings.update({
                    where: { id: settings.id },
                    data: payload,
                });
            }
            res.status(200).json({ success: true, settings });
        }
        catch (error) {
            logger_1.logger.error('Update settings error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
exports.SettingsController = SettingsController;
