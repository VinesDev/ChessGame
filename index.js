const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

const BOT_TOKEN = '8861597783:AAFVjL_5K1fskDBNspdI16jrHlGNiIgTjoE';
const ADMIN_IDS = ['8246027862', '84423337'];

const DB_FILE = './database.json';
if (!fs.existsSync(DB_FILE)) {
    fs.writeJsonSync(DB_FILE, { users: [], rooms: [] });
}
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const db = {
    read: () => fs.readJsonSync(DB_FILE),
    write: (data) => fs.writeJsonSync(DB_FILE, data, { spaces: 2 })
};

// Init Admin
const initAdmin = async () => {
    let data = db.read();
    if (!data.users.find(u => u.username === 'Chess Acc')) {
        const hashed = await bcrypt.hash('Vines_Chess_888!', 10);
        data.users.push({
            id: 'admin-1', username: 'Chess Acc', password: hashed, bio: 'Official Admin',
            role: 'admin', profilePic: 'https://files.catbox.moe/y7ha6w.jpeg', friends: [], likes: 100
        });
        db.write(data);
    }
};
initAdmin();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));
const upload = multer({ dest: 'uploads/' });

// --- API AUTH ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    let data = db.read();
    if (data.users.find(u => u.username === username)) return res.status(400).json({ error: 'Username sudah dipakai' });
    
    const hashed = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now().toString(), username, password: hashed, bio: '', role: 'user',
        profilePic: 'https://files.catbox.moe/pngw2k.jpeg', friends: [], likes: 0
    };
    data.users.push(newUser);
    db.write(data);
    res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    let data = db.read();
    const user = data.users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'Username atau password salah' });
    }
    const token = jwt.sign({ id: user.id }, 'SECRET_CHESS_KEY', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, profilePic: user.profilePic, likes: user.likes } });
});

// --- API ROOMS ---
app.post('/api/rooms/create', (req, res) => {
    const { hostId, timer, password } = req.body;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase(); // ID Ruangan (6 karakter)
    let data = db.read();
    
    const newRoom = {
        id: roomId,
        hostId: hostId,
        timer: timer,
        password: password || null, // null = no password
        createdAt: Date.now()
    };
    
    data.rooms.push(newRoom);
    db.write(data);
    
    // Kirim link rahasia (cuma dibalikin ke response ini)
    const secretLink = `/room/${roomId}?bypass=${hostId}`;
    res.json({ success: true, room: newRoom, secretLink });
});

app.get('/api/rooms', (req, res) => {
    let data = db.read();
    // Urutkan: yang gak ada password di atas, yang ada password di bawah
    const sortedRooms = data.rooms.sort((a, b) => (a.password === b.password ? 0 : a.password ? 1 : -1));
    res.json(sortedRooms);
});

// --- API LAPOR KE TELEGRAM ---
app.post('/api/report', async (req, res) => {
    const { type, reason, targetUser } = req.body;
    const text = `🚨 **LAPORAN BARU** 🚨\n\nTarget: ${targetUser}\nJenis: ${type}\nAlasan: ${reason || 'Tidak ada alasan'}`;
    try {
        for (const admin of ADMIN_IDS) {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: admin, text: text, parse_mode: 'Markdown'
            });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal kirim laporan' });
    }
});

// Route untuk masuk ke ruangan via link
app.get('/room/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'room.html')); // Lo bisa bikin UI catur di sini nanti
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chess Roam running on port ${PORT}`);
});
