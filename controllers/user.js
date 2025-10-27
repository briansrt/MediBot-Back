import getClient from "../db/mongo.js";

export const crearUser = async (req, res) => {
    const client = await getClient();
    try {

    const event = req.body;
    if (event.type === "user.created") {
      const data = event.data;
      await client.db('MediBot').collection('users').insertOne({
        userId: data.id,
        email: data.email_addresses[0].email_address || data.primary_email_address_id,
        firstName: data.first_name,
        lastName: data.last_name,
        createdAt: new Date(),
      });
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
}
