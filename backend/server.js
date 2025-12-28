import express from 'express';
import dotenv from 'dotenv';
import session from 'express-session';
import path from 'path';
import bodyParser from 'body-parser';
import mainroutes from'./routes/mainroutes.js';
import tournamentRoutes from './routes/tournamentRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import mongoose from 'mongoose';

dotenv.config();
const app = express();

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ MongoDB connected')).catch(err => console.error('MongoDB connection error:', err));

app.use(express.static(path.join(import.meta.dirname, '../frontend')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // true if HTTPS
}));
// Routes
app.use('/', mainroutes);
app.use('/api', tournamentRoutes);
app.use('/api', registrationRoutes);
app.use('/api', tournamentRoutes);

app.listen(5000, () => {
    console.log("Server started at http://localhost:5000");
});