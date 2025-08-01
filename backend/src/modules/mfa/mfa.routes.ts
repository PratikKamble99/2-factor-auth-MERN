import { authenticateJWT } from './../../common/strategies/jwt.strategy';
import { Router } from "express";
import { mfaController } from "./mfa.module";

const mfaRoutes = Router();

mfaRoutes.get('/setup', authenticateJWT, mfaController.generateMfaSetup)
mfaRoutes.post('/verify', authenticateJWT, mfaController.verifyMfaSetup)
mfaRoutes.put('/revoke', authenticateJWT, mfaController.revokeMfa)

mfaRoutes.post("/verify-login", mfaController.verifyMFAForLogin);


export default mfaRoutes;
