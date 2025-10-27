import express, { urlencoded, json } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.routes.js';
import salaRoutes from './routes/salaRoutes.routes.js';
import MediBotRoutes from './routes/MediBotRoutes.routes.js';
dotenv.config();

const port = process.env.PORT;

const app = express();

app.use(urlencoded({extended: true}))
app.use(json())


app.use(cors());


app.use('/api/user', userRoutes);
app.use('/api/sala', salaRoutes);
app.use('/api/MediBot', MediBotRoutes);

app.get('/', (req, res) => {
    res.send('¡Hola, mundo! y !Hola Medibot');
});

app.listen(port, ()=>{
    console.log(`listening at port http://localhost:${port}`);
})
