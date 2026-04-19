"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("./settings.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
// Publicly readable for dynamic frontend theming
router.get('/', settings_controller_1.SettingsController.getSettings);
// Protected update route
router.patch('/', auth_middleware_1.authenticateToken, role_middleware_1.requireAdmin, settings_controller_1.SettingsController.updateSettings);
exports.default = router;
