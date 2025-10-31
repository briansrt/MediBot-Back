import express from 'express';
import { crearSala, enviarMensaje} from '../controllers/sala.js';
import { actualizarFeedback, getMetricas } from '../controllers/metrica.js';
const router = express.Router();

router.post('/crearSala', crearSala);
router.post('/mensaje', enviarMensaje);
router.post('/feedback', actualizarFeedback);
router.get('/metrica', getMetricas);

export default router;