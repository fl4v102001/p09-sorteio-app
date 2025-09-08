import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173' }
});

const rooms = {}; // Estrutura: { roomId: { users: { socketId: { userId, role } }, sorteador: socketId } }

function mapRoles(users) {
  return Object.entries(users).map(([socketId, { userId, role }]) => ({
    socketId,
    userId,
    role,
  }));
}

io.on('connection', (socket) => {
  console.log(`🟢 Nova conexão: ${socket.id}`);

  socket.on('joinRoom', ({ roomId, userId }) => {
    console.log(`➡️ Usuário ${userId} entrou na sala ${roomId}`);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: {}, sorteador: null };
      console.log(`📁 Sala ${roomId} criada`);
    }

    // Verifica se o userId já existia
    const existingEntry = Object.entries(rooms[roomId].users).find(
      ([, user]) => user.userId === userId
    );

    let role = 'ESPECTADOR';

    if (existingEntry) {
      role = existingEntry[1].role;
      console.log(`🔄 Reassociando ${userId} como ${role}`);
    } else {
      const hasSorteador = Object.values(rooms[roomId].users).some(u => u.role === 'SORTEADOR');
      if (!hasSorteador) {
        role = 'SORTEADOR';
        rooms[roomId].sorteador = socket.id;
        console.log(`👑 ${userId} definido como primeiro SORTEADOR`);
      }
    }

    rooms[roomId].users[socket.id] = { userId, role };
    socket.join(roomId);

    io.to(roomId).emit('roleUpdate', mapRoles(rooms[roomId].users));
  });

  socket.on('drawNumber', ({ roomId, keepSorteador }) => {
    const number = Math.floor(Math.random() * 100) + 1;
    console.log(`🎲 Número sorteado na sala ${roomId}: ${number}`);
    io.to(roomId).emit('numberDrawn', number);

    if (!keepSorteador) {
      const userIds = Object.keys(rooms[roomId].users).filter(id => id !== socket.id);
      const newSorteador = userIds[Math.floor(Math.random() * userIds.length)];

      rooms[roomId].users[socket.id].role = 'ESPECTADOR';
      rooms[roomId].users[newSorteador].role = 'SORTEADOR';
      rooms[roomId].sorteador = newSorteador;

      console.log(`🔁 Troca de SORTEADOR: ${rooms[roomId].users[newSorteador].userId}`);
    } else {
      console.log(`🔒 ${rooms[roomId].users[socket.id].userId} manteve-se como SORTEADOR`);
    }

    io.to(roomId).emit('roleUpdate', mapRoles(rooms[roomId].users));
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Desconectado: ${socket.id}`);

    for (const roomId in rooms) {
      if (rooms[roomId].users[socket.id]) {
        const userId = rooms[roomId].users[socket.id].userId;
        const wasSorteador = rooms[roomId].users[socket.id].role === 'SORTEADOR';

        delete rooms[roomId].users[socket.id];
        console.log(`❌ Usuário ${userId} removido da sala ${roomId}`);

        if (wasSorteador) {
          rooms[roomId].sorteador = null;
          const remaining = Object.keys(rooms[roomId].users);
          if (remaining.length > 0) {
            const newSorteador = remaining[0];
            rooms[roomId].users[newSorteador].role = 'SORTEADOR';
            rooms[roomId].sorteador = newSorteador;
            console.log(`👑 Novo SORTEADOR após desconexão: ${rooms[roomId].users[newSorteador].userId}`);
          }
        }

        io.to(roomId).emit('roleUpdate', mapRoles(rooms[roomId].users));
      }
    }
  });
});

httpServer.listen(3000, () => console.log('🚀 Servidor rodando na porta 3000'));