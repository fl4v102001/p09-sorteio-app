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
}

// --- Componente React ---

function App() {
  const [role, setRole] = useState<UserRole>('ESPECTADOR');
  const [number, setNumber] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [keepSorteador, setKeepSorteador] = useState(false);
  const roomId = 'sala1';

  useEffect(() => {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('userId', userId);
    }

    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Conectado:', newSocket.id);
      newSocket.emit('joinRoom', { roomId, userId: userId! });
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
  }, []);

  const handleDraw = () => {
    if (socket) {
      socket.emit('drawNumber', { roomId, keepSorteador });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Sorteio de Números</h1>
      <p>Você é: <strong>{role}</strong></p>

      {role === 'SORTEADOR' && (
        <>
          <button onClick={handleDraw}>Sortear Número</button>
          <label style={{ marginLeft: 10 }}>
            <input
              type="checkbox"
              checked={keepSorteador}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeepSorteador(e.target.checked)}
            />
            Manter como sorteador
          </label>
        </>
      )}

      {number !== null && <h2>Número sorteado: {number}</h2>}

      <h3>Participantes:</h3>
      <ul>
        {users.map(({ socketId, userId: uid, role: papel }) => (
          <li key={socketId}>
            {uid === localStorage.getItem('userId') ? 'Você' : uid.substring(0, 8)}: {papel}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
