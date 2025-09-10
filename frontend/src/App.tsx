import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// --- Definição de Tipos (espelhando o backend) ---
type UserRole = 'SORTEADOR' | 'ESPECTADOR';

interface User {
  socketId: string;
  userId: string;
  role: UserRole;
}

interface ServerToClientEvents {
  roleUpdate: (users: User[]) => void;
  numberDrawn: (number: number) => void;
}

interface ClientToServerEvents {
  joinRoom: (data: { roomId: string; userId: string }) => void;
  drawNumber: (data: { roomId: string; keepSorteador: boolean }) => void;
  transferRole: (data: { roomId: string; targetSocketId: string }) => void; // Novo evento
}

// --- Componente React ---

function App() {
  const [role, setRole] = useState<UserRole>('ESPECTADOR');
  const [number, setNumber] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [keepSorteador, setKeepSorteador] = useState(false);
  const roomId = 'sala1';
  const userId = localStorage.getItem('userId') || crypto.randomUUID();

  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', userId);
    }

    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Conectado:', newSocket.id);
      newSocket.emit('joinRoom', { roomId, userId });
    });

    newSocket.on('roleUpdate', (userRoles) => {
      setUsers(userRoles);
      const currentUser = userRoles.find((u) => u.userId === userId);
      setRole(currentUser?.role || 'ESPECTADOR');
    });

    newSocket.on('numberDrawn', (num) => setNumber(num));

    return () => {
      newSocket.disconnect();
    };
  }, [userId]);

  const handleDraw = () => {
    if (socket) {
      socket.emit('drawNumber', { roomId, keepSorteador });
    }
  };

  // +++ INÍCIO DA NOVA LÓGICA +++
  const handleTransferRole = (targetSocketId: string) => {
    if (socket) {
      socket.emit('transferRole', { roomId, targetSocketId });
    }
  };
  // +++ FIM DA NOVA LÓGICA +++

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Sorteio de Números</h1>
      <p>Seu ID de usuário: <strong>{userId.substring(0, 8)}</strong></p>
      <p>Seu papel: <strong>{role}</strong></p>

      {role === 'SORTEADOR' && (
        <div style={{ border: '1px solid #ccc', padding: 10, marginBottom: 20 }}>
          <h3>Painel do Sorteador</h3>
          <button onClick={handleDraw}>Sortear Número</button>
          <label style={{ marginLeft: 10 }}>
            <input
              type="checkbox"
              checked={keepSorteador}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeepSorteador(e.target.checked)}
            />
            Manter como sorteador
          </label>
        </div>
      )}

      {number !== null && <h2>Último número sorteado: {number}</h2>}

      <h3>Participantes na Sala:</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {users.map(({ socketId, userId: uid, role: papel }) => (
          <li key={socketId} style={{ marginBottom: 10, padding: 5, border: '1px solid #eee' }}>
            <span>
              {uid === userId ? 'Você' : `Usuário ${uid.substring(0, 8)}`}: <strong>{papel}</strong>
            </span>
            {/* +++ INÍCIO DA RENDERIZAÇÃO CONDICIONAL DO BOTÃO +++ */}
            {role === 'SORTEADOR' && papel === 'ESPECTADOR' && (
              <button 
                onClick={() => handleTransferRole(socketId)} 
                style={{ marginLeft: 15 }}
              >
                Tornar Sorteador
              </button>
            )}
            {/* +++ FIM DA RENDERIZAÇÃO CONDICIONAL DO BOTÃO +++ */}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;