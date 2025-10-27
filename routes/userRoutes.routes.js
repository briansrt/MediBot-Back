import express from 'express';
import { crearUser} from '../controllers/user.js';
const router = express.Router();

router.post('/crearUser', crearUser);

export default router;