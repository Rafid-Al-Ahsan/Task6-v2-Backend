const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://127.0.0.1:8080",
        methods: ["GET", "POST"]
    }
});

const presentations = {};  // Store presentation data here (in-memory)
const users = {};          // Track connected users

// Middleware
app.use(cors({ origin: "http://127.0.0.1:8080" }));
app.use(express.json());
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_presentation', ({ presentationId, nickname }) => {
        socket.join(presentationId);

        if (!presentations[presentationId]) {
            presentations[presentationId] = {
                creator: socket.id,
                slides: [],
                drawings: {}, // Store drawings for each slide
                users: {}
            };
        }

        presentations[presentationId].users[socket.id] = { nickname, role: 'viewer' };
        users[socket.id] = presentationId;

        io.to(presentationId).emit('update_users', presentations[presentationId].users);

        // Emit existing slides and drawings to the new user
        socket.emit('slides_updated', presentations[presentationId].slides);
        socket.emit('drawings_updated', presentations[presentationId].drawings);
    });

    socket.on('add_slide', () => {
        const presentationId = users[socket.id];
        const newSlide = `Slide ${presentations[presentationId].slides.length + 1}`;
        presentations[presentationId].slides.push(newSlide);
        io.to(presentationId).emit('slides_updated', presentations[presentationId].slides);
    });

    socket.on('draw', ({ presentationId, slideId, x, y, newX, newY }) => {
        socket.to(presentationId).emit('draw_line', { slideId, x, y, newX, newY });
        if (!presentations[presentationId].drawings[slideId]) {
            presentations[presentationId].drawings[slideId] = [];
        }
        presentations[presentationId].drawings[slideId].push({ x, y, newX, newY });
    });

    socket.on('assign_role', ({ userId, role }) => {
        const presentationId = users[socket.id];
        presentations[presentationId].users[userId].role = role;
        io.to(presentationId).emit('update_users', presentations[presentationId].users);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const presentationId = users[socket.id];
        if (presentationId) {
            delete presentations[presentationId].users[socket.id];
            delete users[socket.id];
            io.to(presentationId).emit('update_users', presentations[presentationId].users);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});