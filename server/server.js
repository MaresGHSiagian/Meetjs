const express = require("express");
const path = require("path");
const db = require("./db/connection"); // Tambah koneksi DB

const app = express();

// Buat HTTP server dari Express app
const server = require('http').createServer(app);

// Inisialisasi Socket.IO
const { Server } = require('socket.io');
const io = new Server(server);  // ✅ inisialisasi io

const PORT = 3000;

// Middleware: Serve static files dari folder 'public'
app.use(express.static(path.join(__dirname, '..', 'public')));

// Route utama: kirim file index.html dari root project
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  // Tambah event lainnya sesuai kebutuhan
});



// WebRTC signaling and chat handling
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // Join room
  socket.on("join-room", (room, name) => {
    socket.join(room);
    socket.room = room;
    socket.name = name;

    // Notify existing clients in the room
    socket.to(room).emit("user-joined", { id: socket.id, name });

    console.log(`✅ ${name} joined room: ${room} (ID: ${socket.id})`);
  });

  

  // WebRTC signaling
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  // Chat message relay with improved handling
  socket.on("chat", (message) => {
    const room = socket.room;
    const name = socket.name;

    if (room && name) {
      console.log(`💬 Message from ${name} in room ${room}: ${message}`);

      // Send chat to all in room (including sender if desired)
      io.to(room).emit("chat", { sender: name, message });
      
      // If you want only others (not sender) to receive it, use this:
      // socket.to(room).emit("chat", { sender: name, message });
    } else {
      console.warn("⚠️ Chat received but room or name undefined.");
    }
  });

  // Notify disconnection
  socket.on("disconnect", () => {
    const room = socket.room;
    if (room) {
      socket.to(room).emit("user-left", { id: socket.id, name: socket.name });
    }
    console.log("❌ User disconnected:", socket.id);
  });
});


  io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);
  
    // User join room → kita simpan room_name & user info di socket
    socket.on("join-room", ({ room_name, name, user_id }) => {
      socket.join(room_name);
      socket.room_name = room_name;  // ⬅️ simpan nama room
      socket.name = name;
      socket.user_id = user_id;
  
      console.log(`👥 ${name} joined room ${room_name}`);
    });
  
    // Saat chat masuk
    socket.on("chat", (message) => {
      const room_name = socket.room_name;
      const user_id = socket.user_id;
      const name = socket.name;
  
      if (room_name && user_id && name) {
        console.log(`💬 Message from ${name} in room ${room_name}: ${message}`);
  
        // Cari room_id berdasarkan room_name
        const getRoomIdQuery = "SELECT id FROM rooms WHERE room_name = ?";
        db.query(getRoomIdQuery, [room_name], (err, results) => {
          if (err) {
            console.error("❌ Gagal cari room_id:", err.sqlMessage);
            return;
          }
  
          if (results.length === 0) {
            console.warn("⚠️ Room tidak ditemukan:", room_name);
            return;
          }
  
          const room_id = results[0].id;
  
          // Simpan chat ke tabel chats
          const insertChatQuery = `
            INSERT INTO chats (room_id, user_id, message) 
            VALUES (?, ?, ?)
          `;
          db.query(insertChatQuery, [room_id, user_id, message], (err, result) => {
            if (err) {
              console.error("❌ Gagal simpan chat:", err.sqlMessage);
            } else {
              console.log("✅ Chat berhasil disimpan");
            }
          });
  
          // Broadcast ke semua user di room
          io.to(room_name).emit("chat", { sender: name, message });
        });
  
      } else {
        console.warn("⚠️ Chat gagal, data tidak lengkap.");
      }
    });
 
  // WebRTC signaling events
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const room = socket.room;
    if (room) {
      socket.to(room).emit("user-left", { id: socket.id, name: socket.name });
    }
    console.log("❌ User disconnected:", socket.id);
  });
});

// Start server
server.listen(PORT, "localhost", () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

