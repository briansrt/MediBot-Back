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
