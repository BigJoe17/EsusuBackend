import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authenticateToken } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';

const router = Router();

// Publicly readable for dynamic frontend theming
router.get('/', SettingsController.getSettings as any);

// Protected update route
router.patch('/', authenticateToken as any, requireAdmin as any, SettingsController.updateSettings as any);

export default router;
