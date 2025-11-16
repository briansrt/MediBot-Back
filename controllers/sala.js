import PDFDocument from "pdfkit";
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import getClient from "../db/mongo.js";
import { registrarMetrica } from "./metrica.js";
import { ObjectId } from "mongodb";
import moment from "moment-timezone";
import dotenv from 'dotenv';

dotenv.config();

const Bedrockclient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_ID,
  },
});

export const crearSala = async (req, res) => {
    const client = await getClient();
    const { userId, dolor, nombre } = req.body;

    if (!userId || !dolor || !nombre) {
        return res.status(400).json({ status: "Error", message: "Faltan campos requeridos" });
    }

    const message = `Hola, mi nombre es ${nombre} y me duele ${dolor} `;
    const currentDateTime = moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss');

    try {
        console.log("🧩 Insertando sesión en MongoDB...");
        const result = await client.db('MediBot').collection('session').insertOne({
            userId,
            dolor,
            startedAt: currentDateTime,
            endedAt: null
        });

        const sessionId = result.insertedId.toString();
        console.log("✅ Sesión creada con ID:", sessionId);

        const command = new InvokeAgentCommand({
            agentId: process.env.BEDROCK_AGENT_ID,
            agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
            sessionId,
            inputText: message
        });

        console.log("📡 Enviando mensaje al agente de Bedrock...");
        const response = await Bedrockclient.send(command);
        let messageBot = "⚠️ El agente no devolvió contenido.";
        if (response.completion) {
            const dec = new TextDecoder();
            let text = "";
            for await (const ev of response.completion) {
                if (ev.chunk?.bytes) text += dec.decode(ev.chunk.bytes);
            }
            messageBot = text || messageBot;
        }

        console.log("✅ Respuesta del bot:", messageBot);
        const botTimestamp = moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss');

        await client.db('MediBot').collection('messages').insertOne({
            sessionId: new ObjectId(sessionId),
            role: "bot",
            text: messageBot,
            timestamp: botTimestamp
        });
        

        return res.json({
            status: "Sala Creada",
            fecha: currentDateTime,
            sessionId,
            respuesta: messageBot
        });
    } catch (error) {
        console.error('❌ Error al crear la sala:', error);
        return res.status(500).json({ status: "Error", message: "Error interno del servidor" });
    }
};

export const enviarMensaje = async (req, res) => {
  const client = await getClient();
  const { sessionId, userId, message } = req.body;

  try {
    const inicio = Date.now();
    const currentDateTime = moment().tz("America/Bogota").format("YYYY-MM-DD HH:mm:ss");

    await client.db("MediBot").collection("messages").insertOne({
      sessionId: new ObjectId(sessionId),
      userId,
      role: "user",
      text: message,
      timestamp: currentDateTime,
    });

    const command = new InvokeAgentCommand({
      agentId: process.env.BEDROCK_AGENT_ID,
      agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
      sessionId,
      inputText: message,
    });

    const response = await Bedrockclient.send(command);
    let messageBot = "⚠️ El agente no devolvió contenido.";
    if (response.completion) {
      const dec = new TextDecoder();
      let text = "";
      for await (const ev of response.completion) {
        if (ev.chunk?.bytes) text += dec.decode(ev.chunk.bytes);
      }
      messageBot = text || messageBot;
    }

    const fin = Date.now();
    const duracionRespuesta = fin - inicio;

    const botTimestamp = moment().tz("America/Bogota").format("YYYY-MM-DD HH:mm:ss");
    await client.db("MediBot").collection("messages").insertOne({
      sessionId: new ObjectId(sessionId),
      role: "bot",
      text: messageBot,
      timestamp: botTimestamp,
    });

    // Registrar métricas
    await registrarMetrica({
      duracionRespuesta,
      falloIntencion: messageBot.includes("no entiendo") || messageBot.includes("no puedo"),
      feedback: "", // Aquí podrías pasar feedback del usuario si existe
    });

    res.json({ status: "Mensaje Enviado", fecha: botTimestamp, respuesta: messageBot });
  } catch (error) {
    console.error("Error al enviar el mensaje", error);
    res.status(500).json({ status: "Error", message: "Internal Server Error" });
  }
};

export const getTodasLasSesiones = async (req, res) => {
    const client = await getClient();

    try {
        const sesiones = await client.db("MediBot")
            .collection("session")
            .find({})
            .sort({ startedAt: -1 })
            .toArray();

        res.json({
            status: "OK",
            total_sesiones: sesiones.length,
            sesiones
        });

    } catch (error) {
        console.error("❌ Error obteniendo sesiones:", error);
        res.status(500).json({ status: "Error", message: "Error interno del servidor" });
    }
};

export const getSesionesPorUsuario = async (req, res) => {
    const client = await getClient();
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ status: "Error", message: "userId es requerido" });
    }

    try {
        const sesiones = await client.db("MediBot")
            .collection("session")
            .find({ userId })
            .sort({ startedAt: -1 })
            .toArray();

        res.json({
            status: "OK",
            total_sesiones: sesiones.length,
            sesiones
        });

    } catch (error) {
        console.error("❌ Error obteniendo sesiones por usuario:", error);
        res.status(500).json({ status: "Error", message: "Error interno del servidor" });
    }
};


export const getConversacionPorSession = async (req, res) => {
    const client = await getClient();
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ status: "Error", message: "sessionId es requerido" });
    }

    try {
        const mensajes = await client
            .db("MediBot")
            .collection("messages")
            .find({ sessionId: new ObjectId(sessionId) })
            .sort({ timestamp: 1 })
            .toArray();

        return res.json({
            status: "OK",
            sessionId,
            mensajes
        });
    } catch (error) {
        console.error("❌ Error obteniendo conversación:", error);
        res.status(500).json({ status: "Error", message: "Error interno del servidor" });
    }
};

export const getConversacionesPorUsuario = async (req, res) => {
    const client = await getClient();
    const { userId } = req.query;

    if (!userId || userId.trim() === "") {
        return res.status(400).json({
            status: "Error",
            message: "El parámetro userId es obligatorio"
        });
    }

    try {
        const db = client.db("MediBot");

        // 1️⃣ Obtener todas las sesiones de ese usuario
        const sesiones = await db.collection("session")
            .find({ userId })
            .sort({ startedAt: -1 })
            .toArray();

        if (sesiones.length === 0) {
            return res.json({
                status: "OK",
                message: "El usuario no tiene conversaciones registradas",
                sesiones: []
            });
        }

        // 2️⃣ Agregar mensajes por cada sesión
        const sesionesConMensajes = await Promise.all(
            sesiones.map(async (s) => {
                const mensajes = await db.collection("messages")
                    .find({ sessionId: s._id })
                    .sort({ timestamp: 1 })
                    .toArray();

                return {
                    sessionId: s._id,
                    dolor: s.dolor,
                    startedAt: s.startedAt,
                    endedAt: s.endedAt,
                    mensajes
                };
            })
        );

        return res.json({
            status: "OK",
            total_sesiones: sesionesConMensajes.length,
            sesiones: sesionesConMensajes
        });

    } catch (error) {
        console.error("❌ Error obteniendo conversaciones por usuario:", error);
        res.status(500).json({
            status: "Error",
            message: "Error interno del servidor"
        });
    }
};

export const exportarConversacionPDF = async (req, res) => {
    const client = await getClient();
    const db = client.db("MediBot");
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ status: "Error", message: "sessionId es requerido" });
    }

    try {
        // 1️⃣ Obtener la sesión
        const sesion = await db.collection("session").findOne({ _id: new ObjectId(sessionId) });

        if (!sesion) {
            return res.status(404).json({ status: "Error", message: "Sesión no encontrada" });
        }

        // 2️⃣ Obtener mensajes de la sesión
        const mensajes = await db.collection("messages")
            .find({ sessionId: new ObjectId(sessionId) })
            .sort({ timestamp: 1 })
            .toArray();

        // 3️⃣ Obtener lista de medicamentos del sistema
        const medicamentosDB = await db.collection("medicamentos")
            .find({})
            .project({ nombre_comercial: 1, nombre_generico: 1 })
            .toArray();

        const listaMedicamentos = medicamentosDB.flatMap(m => [
            m.nombre_comercial?.toLowerCase(),
            m.nombre_generico?.toLowerCase()
        ]).filter(Boolean);

        // 4️⃣ Detectar medicamentos recomendados en los mensajes del bot
        let medicamentosRecomendados = new Set();

        mensajes.forEach(msg => {
            if (msg.role === "bot") {
                listaMedicamentos.forEach(med => {
                    if (msg.text.toLowerCase().includes(med)) {
                        medicamentosRecomendados.add(med);
                    }
                });
            }
        });

        medicamentosRecomendados = Array.from(medicamentosRecomendados);

        // 5️⃣ Crear PDF
        const doc = new PDFDocument({ margin: 40 });

        const fileName = `Conversacion_${sessionId}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

        doc.pipe(res);

        // 📌 Título principal
        doc.fontSize(20).text("Resumen de la Conversación", { align: "center" });
        doc.moveDown();

        // 📌 Resumen de la sesión
        doc.fontSize(14).text("Información de la sesión", { underline: true });
        doc.moveDown(0.8);

        doc.fontSize(12)
            .text(`Usuario (userId): ${sesion.userId}`)
            .text(`Dolor reportado: ${sesion.dolor}`)
            .text(`Fecha de inicio: ${sesion.startedAt}`)
            .text(`Fecha de fin: ${sesion.endedAt ?? "En curso"}`)
            .text(`Total de mensajes: ${mensajes.length}`);
        doc.moveDown();

        // 📌 Medicamentos recomendados
        doc.fontSize(14).text("Medicamentos recomendados", { underline: true });
        doc.moveDown(0.5);

        if (medicamentosRecomendados.length === 0) {
            doc.fontSize(12).text("No se detectaron medicamentos recomendados.");
        } else {
            medicamentosRecomendados.forEach(med => {
                doc.fontSize(12).text(`• ${med}`);
            });
        }

        doc.moveDown(2);

        // 💬 Conversación completa
        doc.fontSize(16).text("Conversación Completa", { underline: true });
        doc.moveDown();

        mensajes.forEach(msg => {
            doc.fontSize(12)
                .text(`[${msg.timestamp}] ${msg.role.toUpperCase()}: ${msg.text}`);
            doc.moveDown(0.6);
        });

        doc.end();

    } catch (error) {
        console.error("❌ Error generando PDF:", error);
        res.status(500).json({ status: "Error", message: "Error generando el PDF" });
    }
};
