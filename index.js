const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // Import CORS

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://127.0.0.1:8080",  // Allow frontend origin
        methods: ["GET", "POST"]
    }
});

const presentations = {};  // Store presentation data here (in-memory)
const users = {};          // Track connected users

// Middleware
app.use(cors({ origin: "http://127.0.0.1:8080" }));  // Apply CORS middleware
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
                users: {}
            };
        }

        presentations[presentationId].users[socket.id] = { nickname, role: 'viewer' };
        users[socket.id] = presentationId;

        io.to(presentationId).emit('update_users', presentations[presentationId].users);
    });

    socket.on('assign_role', ({ userId, role }) => {
        const presentationId = users[socket.id];
        if (presentations[presentationId] && presentations[presentationId].creator === socket.id) {
            presentations[presentationId].users[userId].role = role;
            io.to(presentationId).emit('update_users', presentations[presentationId].users);
        }
    });

    socket.on('edit_slide', ({ slideId, content }) => {
        const presentationId = users[socket.id];
        const presentation = presentations[presentationId];

        if (presentation) {
            presentation.slides[slideId] = content;
            io.to(presentationId).emit('slide_updated', { slideId, content });
        }
    });

    socket.on('add_slide', () => {
        const presentationId = users[socket.id];
        if (presentations[presentationId].creator === socket.id) {
            const newSlideId = presentations[presentationId].slides.length;
            presentations[presentationId].slides.push('');
            io.to(presentationId).emit('slides_updated', presentations[presentationId].slides);
        }
    });

    socket.on('disconnect', () => {
        const presentationId = users[socket.id];
        if (presentationId) {
            delete presentations[presentationId].users[socket.id];
            io.to(presentationId).emit('update_users', presentations[presentationId].users);
        }
    });

    // Handle role assignment
    socket.on('assign_role', ({ userId, role }) => {
        const presentationId = users[socket.id];
        if (presentations[presentationId] && presentations[presentationId].creator === socket.id) {
            presentations[presentationId].users[userId].role = role;
            io.to(presentationId).emit('update_users', presentations[presentationId].users);
        }
    });

    // Handle drawing
    socket.on('draw', ({ presentationId, slideId, x, y, newX, newY }) => {
        if (presentationId) {
            io.to(presentationId).emit('draw_line', { slideId, x, y, newX, newY });
        }
    });

});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
