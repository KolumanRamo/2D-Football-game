const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'users.json');
const JWT_SECRET = 'super-secret-arcade-key-123!';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '')));

// Initialize DB file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
}

// Helper functions for DB
function readDB() {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- AUTHENTICATION ENDPOINTS ---

// Register
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password || username.trim() === '' || password.trim() === '') {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
    }

    const db = readDB();

    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now().toString(),
            username: username,
            password: hashedPassword,
            coins: 0,
            unlockedTrails: ['default'],
            equippedTrail: 'default'
        };

        db.users.push(newUser);
        writeDB(db);

        // Auto-login
        const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

        // Don't send password back
        const { password: _, ...userWithoutPassword } = newUser;

        res.status(201).json({
            message: 'Kayıt başarılı!',
            token,
            user: userWithoutPassword
        });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Küllanıcı adı ve şifre zorunludur.' });
    }

    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
        return res.status(401).json({ error: 'Kullanıcı bulunamadı veya şifre hatalı.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return res.status(401).json({ error: 'Kullanıcı bulunamadı veya şifre hatalı.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    const { password: _, ...userWithoutPassword } = user;

    res.json({
        message: 'Giriş başarılı!',
        token,
        user: userWithoutPassword
    });
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: 'Yetkisiz erişim.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
        req.user = user;
        next();
    });
}

// --- METAGAME ENDPOINTS ---

// Get current user data (for loading coins & trails on start)
app.get('/api/me', authenticateToken, (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.userId);

    if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
});

// Update data (save coins and trails after match or purchase)
app.post('/api/update', authenticateToken, (req, res) => {
    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === req.user.userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const { coins, unlockedTrails, equippedTrail } = req.body;

    // Apply updates if they exist in the payload
    if (coins !== undefined) db.users[userIndex].coins = coins;
    if (unlockedTrails !== undefined) db.users[userIndex].unlockedTrails = unlockedTrails;
    if (equippedTrail !== undefined) db.users[userIndex].equippedTrail = equippedTrail;

    writeDB(db);

    const { password: _, ...updatedUser } = db.users[userIndex];
    res.json({ message: 'Başarıyla güncellendi.', user: updatedUser });
});

// Catch-all route to serve the main HTML file
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
