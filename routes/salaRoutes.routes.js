import express from 'express';
import { crearSala, enviarMensaje, getTodasLasSesiones, getSesionesPorUsuario, getConversacionPorSession, getConversacionesPorUsuario, exportarConversacionPDF} from '../controllers/sala.js';
import { actualizarFeedback, getDoloresFrecuentes, getMedicamentosMasBuscados, getMetricas, exportarMetricasPDF } from '../controllers/metrica.js';
const router = express.Router();

router.post('/crearSala', crearSala);
router.post('/mensaje', enviarMensaje);
router.post('/feedback', actualizarFeedback);

router.get('/sesiones', getTodasLasSesiones);
router.get('/sesionesUsuario', getSesionesPorUsuario);
router.get('/metrica', getMetricas);
router.get('/getDolorFrecuentes', getDoloresFrecuentes);
router.get('/getMedicamentosBuscados', getMedicamentosMasBuscados);
router.get('/conversacion', getConversacionPorSession);
router.get('/conversacionesUsuario', getConversacionesPorUsuario);
router.get('/exportarMetricasPDF', exportarMetricasPDF);
router.get('/exportarConversacionPDF', exportarConversacionPDF);




export default router;