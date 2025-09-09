import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function App() {
  const [role, setRole] = useState('ESPECTADOR');
  const [number, setNumber] = useState(null);
  const [users, setUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [keepSorteador, setKeepSorteador] = useState(false);
  const roomId = 'sala1';

  useEffect(() => {
    // Garante que o userId existe
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('userId', userId);
    }

    // Cria o socket com conexão explícita
    const newSocket = io('http://localhost:3000');
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
          <label>
            <input
              type="checkbox"
              checked={keepSorteador}
              onChange={(e) => setKeepSorteador(e.target.checked)}
            />
            Manter como sorteador
          </label>
        </>
      )}

      {number && <h2>Número sorteado: {number}</h2>}

      <h3>Participantes:</h3>
      <ul>
        {users.map(({ socketId, userId: uid, role: papel }) => (
          <li key={socketId}>
            {uid === localStorage.getItem('userId') ? 'Você' : uid}: {papel}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;