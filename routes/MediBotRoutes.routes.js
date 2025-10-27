import express from 'express';
import { getUsoComun, medicamento, requiere_receta } from '../controllers/medibot.js';
const router = express.Router();

router.get('/getUsoComun', getUsoComun);
router.get('/medicamento', medicamento);
router.get('/receta', requiere_receta);


export default router;