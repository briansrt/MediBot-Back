import moment from "moment-timezone";
import getClient from "../db/mongo.js";

export const registrarMetrica = async (data) => {
  const client = await getClient();
  const fechaHoy = moment().tz("America/Bogota").format("YYYY-MM-DD");

  const {
    duracionRespuesta = 0,
    falloIntencion = false,
    feedback = "",
  } = data;

  try {
    const coleccion = client.db("MediBot").collection("metricas_chatbot");

    // Verificar si ya hay registro del día
    const registroExistente = await coleccion.findOne({ fecha: fechaHoy });

    if (registroExistente) {
      // Actualizar métricas acumuladas del día
      const totalConsultas = registroExistente.total_consultas + 1;
      const nuevoPromedio =
        (registroExistente.promedio_respuesta_ms * registroExistente.total_consultas +
          duracionRespuesta) /
        totalConsultas;

      await coleccion.updateOne(
        { fecha: fechaHoy },
        {
          $set: { promedio_respuesta_ms: nuevoPromedio },
          $inc: {
            total_consultas: 1,
            fallos_intencion: falloIntencion ? 1 : 0,
          },
          $push: {
            feedback_usuarios: feedback ? feedback : null,
          },
        }
      );
    } else {
      // Crear nuevo registro del día
      await coleccion.insertOne({
        fecha: fechaHoy,
        total_consultas: 1,
        promedio_respuesta_ms: duracionRespuesta,
        porcentaje_satisfaccion: 0,
        fallos_intencion: falloIntencion ? 1 : 0,
        feedback_usuarios: feedback ? [feedback] : [],
      });
    }
  } catch (error) {
    console.error("❌ Error registrando métricas:", error);
  }
};

export const actualizarFeedback = async (req, res) => {
  const client = await getClient();
  const { feedback, satisfaccion } = req.body;

  if (!feedback || feedback.trim() === "") {
    return res.status(400).json({ status: "Error", message: "El feedback es obligatorio" });
  }

  if (satisfaccion === undefined || isNaN(satisfaccion) || satisfaccion < 1 || satisfaccion > 5) {
    return res.status(400).json({ status: "Error", message: "La calificación de satisfacción debe estar entre 1 y 5" });
  }

  const fechaRegistro = moment().tz("America/Bogota").format("YYYY-MM-DD");

  try {
    const coleccion = client.db("MediBot").collection("metricas_chatbot");

    // Obtener el registro existente del día
    const registro = await coleccion.findOne({ fecha: fechaRegistro });
    if (!registro) {
      return res.status(404).json({
        status: "Error",
        message: `No se encontró registro de métricas para la fecha ${fechaRegistro}`,
      });
    }

    // Calcular nuevo porcentaje de satisfacción promedio
    const totalRespuestas = registro.total_respuestas_satisfaccion || 0;
    const promedioAnterior = registro.porcentaje_satisfaccion || 0;
    const nuevoPromedio =
      (promedioAnterior * totalRespuestas + satisfaccion) / (totalRespuestas + 1);

    // Actualizar el registro
    await coleccion.updateOne(
      { fecha: fechaRegistro },
      {
        $push: { feedback_usuarios: feedback },
        $set: { porcentaje_satisfaccion: nuevoPromedio },
        $inc: { total_respuestas_satisfaccion: 1 },
      }
    );

    res.json({
      status: "OK",
      message: "✅ Feedback y satisfacción actualizados correctamente",
      fecha: fechaRegistro,
      porcentaje_satisfaccion: nuevoPromedio,
    });
  } catch (error) {
    console.error("❌ Error actualizando feedback:", error);
    res.status(500).json({ status: "Error", message: "Error interno del servidor" });
  }
};

export const getMetricas = async (req, res) => {
  const client = await getClient();
  const coleccion = client.db("MediBot").collection("metricas_chatbot");

  try {
    const { fecha, desde, hasta } = req.query;

    let filtro = {};

    // Buscar por una fecha exacta (ej: ?fecha=2025-10-30)
    if (fecha) {
      filtro.fecha = fecha;
    }

    // Buscar por rango de fechas (ej: ?desde=2025-10-01&hasta=2025-10-30)
    if (desde && hasta) {
      filtro.fecha = { $gte: desde, $lte: hasta };
    }

    const metricas = await coleccion.find(filtro).sort({ fecha: -1 }).toArray();

    if (metricas.length === 0) {
      return res.status(404).json({
        status: "Error",
        message: "No se encontraron métricas para el criterio dado",
      });
    }

    // Calcular métricas globales (útil para dashboard)
    const resumen = {
      total_consultas: metricas.reduce((acc, m) => acc + (m.total_consultas || 0), 0),
      promedio_respuesta_ms:
        metricas.reduce((acc, m) => acc + (m.promedio_respuesta_ms || 0), 0) / metricas.length,
      fallos_intencion: metricas.reduce((acc, m) => acc + (m.fallos_intencion || 0), 0),
      porcentaje_satisfaccion:
        metricas.reduce((acc, m) => acc + (m.porcentaje_satisfaccion || 0), 0) / metricas.length,
      total_dias: metricas.length,
    };

    res.json({
      status: "OK",
      fecha_consulta: moment().tz("America/Bogota").format("YYYY-MM-DD HH:mm:ss"),
      filtro_usado: filtro,
      resumen,
      datos: metricas,
    });
  } catch (error) {
    console.error("❌ Error obteniendo métricas:", error);
    res.status(500).json({ status: "Error", message: "Error interno del servidor" });
  }
};

export const getDoloresFrecuentes = async (req, res) => {
  const client = await getClient();
  try {
    const coleccion = client.db("MediBot").collection("session");

    const resultado = await coleccion.aggregate([
      { $match: { dolor: { $exists: true, $ne: "" } } },
      { $group: { _id: "$dolor", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 } // los 10 dolores más comunes
    ]).toArray();

    res.json({
      status: "OK",
      total_dolores_distintos: resultado.length,
      dolores_mas_frecuentes: resultado.map(d => ({
        dolor: d._id,
        veces_reportado: d.total
      }))
    });
  } catch (error) {
    console.error("❌ Error obteniendo dolores frecuentes:", error);
    res.status(500).json({ status: "Error", message: "Error interno del servidor" });
  }
};

export const getMedicamentosMasBuscados = async (req, res) => {
  const client = await getClient();

  try {
    const resultado = await client.db("MediBot").collection("busquedas_uso_comun")
      .aggregate([
        { $unwind: "$medicamentos_encontrados" },
        {
          $group: {
            _id: "$medicamentos_encontrados",
            total_recomendaciones: { $sum: 1 },
          },
        },
        { $sort: { total_recomendaciones: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    res.json({
      status: "OK",
      medicamentos_mas_recomendados: resultado.map((m) => ({
        medicamento: m._id,
        veces_recomendado: m.total_recomendaciones,
      })),
    });
  } catch (error) {
    console.error("❌ Error obteniendo medicamentos recomendados:", error);
    res.status(500).json({
      status: "Error",
      message: "Error interno del servidor",
    });
  }
};

