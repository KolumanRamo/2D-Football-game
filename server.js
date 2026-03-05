require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-arcade-key-123!';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    coins: { type: Number, default: 0 },
    unlockedTrails: { type: [String], default: ['default'] },
    equippedTrail: { type: String, default: 'default' }
});

const User = mongoose.model('User', userSchema);

// --- AUTHENTICATION ENDPOINTS ---

// Register
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password || username.trim() === '' || password.trim() === '') {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
    }

    try {
        const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (existingUser) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username: username,
            password: hashedPassword,
            coins: 0,
            unlockedTrails: ['default'],
            equippedTrail: 'default'
        });

        await newUser.save();

        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

        const userObj = newUser.toObject();
        delete userObj.password;

        res.status(201).json({
            message: 'Kayıt başarılı!',
            token,
            user: userObj
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Küllanıcı adı ve şifre zorunludur.' });
    }

    try {
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });

        if (!user) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı veya şifre hatalı.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı veya şifre hatalı.' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        const userObj = user.toObject();
        delete userObj.password;

        res.json({
            message: 'Giriş başarılı!',
            token,
            user: userObj
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: 'Yetkisiz erişim.' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
        req.user = decoded;
        next();
    });
}

// --- METAGAME ENDPOINTS ---

// Get current user data
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// Update data
app.post('/api/update', authenticateToken, async (req, res) => {
    try {
        const { coins, unlockedTrails, equippedTrail } = req.body;

        const updates = {};
        if (coins !== undefined) updates.coins = coins;
        if (unlockedTrails !== undefined) updates.unlockedTrails = unlockedTrails;
        if (equippedTrail !== undefined) updates.equippedTrail = equippedTrail;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.userId,
            { $set: updates },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        res.json({ message: 'Başarıyla güncellendi.', user: updatedUser });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// Catch-all route to serve the main HTML file
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
