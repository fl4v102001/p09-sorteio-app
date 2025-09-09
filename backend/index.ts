import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

// --- Definição de Tipos ---

type UserRole = 'SORTEADOR' | 'ESPECTADOR';

interface User {
  userId: string;
  role: UserRole;
}

type UsersMap = Record<string, User>; // socketId -> User

interface Room {
  users: UsersMap;
  sorteador: string | null; // socketId do sorteador
}

type Rooms = Record<string, Room>; // roomId -> Room

// Tipos para os eventos do Socket.IO
interface ServerToClientEvents {
  roleUpdate: (users: { socketId: string; userId: string; role: UserRole }[]) => void;
  numberDrawn: (number: number) => void;
}

interface ClientToServerEvents {
  joinRoom: (data: { roomId: string; userId: string }) => void;
  drawNumber: (data: { roomId: string; keepSorteador: boolean }) => void;
}

// --- Implementação do Servidor ---

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const rooms: Rooms = {};

function mapRoles(users: UsersMap): { socketId: string; userId: string; role: UserRole }[] {
  return Object.entries(users).map(([socketId, { userId, role }]) => ({
    socketId,
    userId,
    role,
  }));
}

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log(`🟢 Nova conexão: ${socket.id}`);

  socket.on('joinRoom', ({ roomId, userId }) => {
    console.log(`➡️ Usuário ${userId} entrou na sala ${roomId}`);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: {}, sorteador: null };
      console.log(`📁 Sala ${roomId} criada`);
    }

    const room = rooms[roomId];

    const existingEntry = Object.entries(room.users).find(
      ([, user]) => user.userId === userId
    );

    let role: UserRole = 'ESPECTADOR';

    if (existingEntry) {
      role = existingEntry[1].role;
      console.log(`🔄 Reassociando ${userId} como ${role}`);
    } else {
      const hasSorteador = Object.values(room.users).some((u) => u.role === 'SORTEADOR');
      if (!hasSorteador) {
        role = 'SORTEADOR';
        room.sorteador = socket.id;
        console.log(`👑 ${userId} definido como primeiro SORTEADOR`);
      }
    }

    room.users[socket.id] = { userId, role };
    socket.join(roomId);

    io.to(roomId).emit('roleUpdate', mapRoles(room.users));
  });

  socket.on('drawNumber', ({ roomId, keepSorteador }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.sorteador) return;

    const number = Math.floor(Math.random() * 100) + 1;
    console.log(`🎲 Número sorteado na sala ${roomId}: ${number}`);
    io.to(roomId).emit('numberDrawn', number);

    if (!keepSorteador) {
      const userIds = Object.keys(room.users).filter((id) => id !== socket.id);
      if (userIds.length > 0) {
        const newSorteadorId = userIds[Math.floor(Math.random() * userIds.length)];
        
        if (room.users[socket.id]) {
          room.users[socket.id].role = 'ESPECTADOR';
        }
        if (room.users[newSorteadorId]) {
          room.users[newSorteadorId].role = 'SORTEADOR';
          room.sorteador = newSorteadorId;
          console.log(`🔁 Troca de SORTEADOR: ${room.users[newSorteadorId].userId}`);
        }
      }
    } else {
      console.log(`🔒 ${room.users[socket.id]?.userId} manteve-se como SORTEADOR`);
    }

    io.to(roomId).emit('roleUpdate', mapRoles(room.users));
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Desconectado: ${socket.id}`);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.users[socket.id]) {
        const { userId, role } = room.users[socket.id];
        const wasSorteador = role === 'SORTEADOR';

        delete room.users[socket.id];
        console.log(`❌ Usuário ${userId} removido da sala ${roomId}`);

        if (wasSorteador) {
          room.sorteador = null;
          const remaining = Object.keys(room.users);
          if (remaining.length > 0) {
            const newSorteadorId = remaining[0];
            room.users[newSorteadorId].role = 'SORTEADOR';
            room.sorteador = newSorteadorId;
            console.log(`👑 Novo SORTEADOR após desconexão: ${room.users[newSorteadorId].userId}`);
          }
        }

        io.to(roomId).emit('roleUpdate', mapRoles(room.users));
      }
    }
  });
});

httpServer.listen(3000, () => console.log('🚀 Servidor rodando na porta 3000'));
