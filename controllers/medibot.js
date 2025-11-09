import { ObjectId } from "mongodb";
import getClient from "../db/mongo.js";

export const getUsoComun = async (req, res) => {
    const client = await getClient();
    const { uso_comun } = req.query;

    if (!uso_comun || uso_comun.trim() === "") {
        return res.status(400).json({ status: "Error", message: "El parámetro uso_comun es obligatorio" });
    }
    try {
        const coleccion = client.db("MediBot").collection("medicamentos");

        // Buscar coincidencias usando regex (case-insensitive)
        const medicamentos = await coleccion
        .find({ uso_comun: { $elemMatch: { $regex: uso_comun, $options: "i" } } })
        .project({
            nombre_comercial: 1,
            nombre_generico: 1,
            descripcion: 1,
            uso_comun: 1,
            dosis_recomendada: 1,
            requiere_receta: 1,
            advertencia: 1,
            _id: 1
        })
        .toArray();

        if (medicamentos.length === 0) {
        return res.json({ status: "OK", message: "No se encontraron medicamentos", data: [] });
        }

        res.json({ status: "OK", data: medicamentos });
    } catch (error) {
        console.error("❌ Error buscando medicamentos:", error);
        res.status(500).json({ status: "Error", message: "Error interno del servidor" });
    }
};

export const medicamento = async (req, res) => {
    const client = await getClient();
  const { nombre } = req.query;

  if (!nombre || nombre.trim() === "") {
    return res.status(400).json({ status: "Error", message: "El parámetro nombre es obligatorio" });
  }

  try {
    const coleccion = client.db("MediBot").collection("medicamentos");

    // Buscar coincidencias exactas o parciales en nombre_comercial o nombre_generico
    const medicamento = await coleccion.findOne({
      $or: [
        { nombre_comercial: { $regex: nombre, $options: "i" } },
        { nombre_generico: { $regex: nombre, $options: "i" } }
      ]
    }, {
      projection: {
        nombre_comercial: 1,
        nombre_generico: 1,
        uso_comun: 1,
        descripcion: 1,
        dosis_recomendada: 1,
        requiere_receta: 1,
        advertencia: 1,
        _id: 1
      }
    });

    if (!medicamento) {
      return res.json({ status: "OK", message: "No se encontró el medicamento", data: null });
    }

    await client.db("MediBot").collection("busquedas_medicamentos").insertOne({
      nombre_busqueda: nombre,
      encontrado: !!medicamento,
      nombre_encontrado: medicamento ? (medicamento.nombre_comercial || medicamento.nombre_generico) : null,
      fecha: moment().tz("America/Bogota").format("YYYY-MM-DD HH:mm:ss"),
    });

    res.json({ status: "OK", data: medicamento });
  } catch (error) {
    console.error("❌ Error obteniendo detalles del medicamento:", error);
    res.status(500).json({ status: "Error", message: "Error interno del servidor" });
  }
};

export const requiere_receta = async (req, res) => {
  const client = await getClient();
  const { nombre } = req.query;

  if (!nombre || nombre.trim() === "") {
    return res.status(400).json({ status: "Error", message: "El parámetro nombre es obligatorio" });
  }

  try {
    const coleccion = client.db("MediBot").collection("medicamentos");

    // Buscar por nombre_comercial o nombre_generico
    const medicamento = await coleccion.findOne({
      $or: [
        { nombre_comercial: { $regex: nombre, $options: "i" } },
        { nombre_generico: { $regex: nombre, $options: "i" } }
      ]
    }, {
      projection: {
        nombre_comercial: 1,
        nombre_generico: 1,
        requiere_receta: 1,
        _id: 0
      }
    });

    if (!medicamento) {
      return res.json({ status: "OK", message: "No se encontró el medicamento", data: null });
    }

    res.json({ status: "OK", data: medicamento });
  } catch (error) {
    console.error("❌ Error verificando receta:", error);
    res.status(500).json({ status: "Error", message: "Error interno del servidor" });
  }
};