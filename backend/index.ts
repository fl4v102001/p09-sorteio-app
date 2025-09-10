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
  receber_solicitacao_de_papel: (requester: { socketId: string; userId: string }) => void;
  solicitacao_recusada: () => void; // Evento de recusa
}

interface ClientToServerEvents {
  joinRoom: (data: { roomId: string; userId: string }) => void;
  drawNumber: (data: { roomId: string; keepSorteador: boolean }) => void;
  transferRole: (data: { roomId: string; targetSocketId: string }) => void;
  solicitar_papel_sorteador: (data: { roomId: string }) => void;
  responder_solicitacao_de_papel: (data: {
    roomId: string;
    aprovado: boolean;
    idDoSolicitante: string;
  }) => void;
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

// +++ LÓGICA REUTILIZÁVEL DE TROCA DE PAPEL +++
function performRoleSwap(roomId: string, oldSorteadorId: string, newSorteadorId: string) {
    const room = rooms[roomId];
    if (!room) return;

    const oldSorteador = room.users[oldSorteadorId];
    const newSorteador = room.users[newSorteadorId];

    if (!oldSorteador || !newSorteador) return;

    console.log(`🔃 Transferindo papel de ${oldSorteador.userId} para ${newSorteador.userId}`);

    oldSorteador.role = 'ESPECTADOR';
    newSorteador.role = 'SORTEADOR';
    room.sorteador = newSorteadorId;

    io.to(roomId).emit('roleUpdate', mapRoles(room.users));
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
    let role: UserRole = 'ESPECTADOR';

    if (!Object.values(room.users).some((u) => u.role === 'SORTEADOR')) {
      role = 'SORTEADOR';
      room.sorteador = socket.id;
      console.log(`👑 ${userId} definido como primeiro SORTEADOR`);
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
            performRoleSwap(roomId, socket.id, newSorteadorId);
        }
    }
    io.to(roomId).emit('roleUpdate', mapRoles(room.users));
  });

  socket.on('transferRole', ({ roomId, targetSocketId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.sorteador) return;
    performRoleSwap(roomId, socket.id, targetSocketId);
  });

  socket.on('solicitar_papel_sorteador', ({ roomId }) => {
    const room = rooms[roomId];
    const requester = room?.users[socket.id];
    if (!room || !requester || !room.sorteador) return;

    console.log(`🙋‍♂️ Usuário ${requester.userId} está solicitando o papel de sorteador.`);
    io.to(room.sorteador).emit('receber_solicitacao_de_papel', {
      socketId: socket.id,
      userId: requester.userId,
    });
  });

  socket.on('responder_solicitacao_de_papel', ({ roomId, aprovado, idDoSolicitante }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.sorteador) return;

    const solicitante = room.users[idDoSolicitante];
    if (!solicitante) return;

    if (aprovado) {
      console.log(`✅ Pedido de ${solicitante.userId} APROVADO.`);
      performRoleSwap(roomId, socket.id, idDoSolicitante);
    } else {
      console.log(`❌ Pedido de ${solicitante.userId} RECUSADO.`);
      // +++ EMITIR EVENTO DE RECUSA PARA O SOLICITANTE +++
      io.to(idDoSolicitante).emit('solicitacao_recusada');
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Desconectado: ${socket.id}`);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.users[socket.id]) {
        const wasSorteador = socket.id === room.sorteador;
        delete room.users[socket.id];

        if (wasSorteador) {
          const remaining = Object.keys(room.users);
          if (remaining.length > 0) {
            const newSorteadorId = remaining[0];
            room.users[newSorteadorId].role = 'SORTEADOR';
            room.sorteador = newSorteadorId;
          } else {
            room.sorteador = null;
          }
        }
        io.to(roomId).emit('roleUpdate', mapRoles(room.users));
      }
    }
  });
});

httpServer.listen(3000, () => console.log('🚀 Servidor rodando na porta 3000'));