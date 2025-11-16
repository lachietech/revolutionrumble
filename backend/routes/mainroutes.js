import express from 'express';
import path from 'path';

const router = express.Router();

// Home page
router.get('/', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/index.html'));
});

router.get('/register', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/register.html'));
});

router.get('/playerstats', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/playerstats.html'));
});

router.get('/results', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/results.html'));
});

export default router;