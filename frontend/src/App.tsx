
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// --- Definição de Tipos (espelhando o backend) ---
type UserRole = 'SORTEADOR' | 'ESPECTADOR';

interface User {
  socketId: string;
  userId: string;
  role: UserRole;
}

interface RequesterInfo {
  socketId: string;
  userId: string;
}

interface ServerToClientEvents {
  roleUpdate: (users: User[]) => void;
  numberDrawn: (number: number) => void;
  receber_solicitacao_de_papel: (requester: RequesterInfo) => void;
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

// --- Componente React ---

function App() {
  const [role, setRole] = useState<UserRole>('ESPECTADOR');
  const [number, setNumber] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [keepSorteador, setKeepSorteador] = useState(false);
  const [solicitacaoPendente, setSolicitacaoPendente] = useState<RequesterInfo | null>(null);
  const [solicitacaoEnviada, setSolicitacaoEnviada] = useState(false);

  const roomId = 'sala1';
  const userId = localStorage.getItem('userId') || crypto.randomUUID();

  // Efeito 1: Apenas para criar e destruir a conexão do socket.
  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', userId);
    }
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId]); // Executa apenas se o userId mudar (basicamente uma vez por sessão)

  // Efeito 2: Apenas para registrar e limpar os listeners de eventos.
  useEffect(() => {
    // Só registra os listeners se o socket já foi criado.
    if (!socket) return;

    const onConnect = () => {
      console.log('Conectado:', socket.id);
      socket.emit('joinRoom', { roomId, userId });
    };

    const onRoleUpdate = (userRoles: User[]) => {
      setUsers(userRoles);
      const currentUser = userRoles.find((u) => u.userId === userId);
      const newRole = currentUser?.role || 'ESPECTADOR';
      setRole(newRole);

      if (newRole === 'SORTEADOR') setSolicitacaoEnviada(false);
      if (solicitacaoPendente && !userRoles.find(u => u.socketId === solicitacaoPendente.socketId)) {
        setSolicitacaoPendente(null);
      }
    };

    const onNumberDrawn = (num: number) => setNumber(num);

    const onReceberSolicitacao = (requester: RequesterInfo) => {
      setSolicitacaoPendente(requester);
    };

    const onSolicitacaoRecusada = () => {
      console.log('Seu pedido foi recusado.');
      setSolicitacaoEnviada(false);
    };

    // Registrando os listeners
    socket.on('connect', onConnect);
    socket.on('roleUpdate', onRoleUpdate);
    socket.on('numberDrawn', onNumberDrawn);
    socket.on('receber_solicitacao_de_papel', onReceberSolicitacao);
    socket.on('solicitacao_recusada', onSolicitacaoRecusada);

    // Função de limpeza para remover os listeners
    return () => {
      socket.off('connect', onConnect);
      socket.off('roleUpdate', onRoleUpdate);
      socket.off('numberDrawn', onNumberDrawn);
      socket.off('receber_solicitacao_de_papel', onReceberSolicitacao);
      socket.off('solicitacao_recusada', onSolicitacaoRecusada);
    };
  }, [socket, userId, solicitacaoPendente]); // Depende do socket para registrar/remover listeners

  const handleDraw = () => socket?.emit('drawNumber', { roomId, keepSorteador });
  const handleTransferRole = (targetSocketId: string) => socket?.emit('transferRole', { roomId, targetSocketId });
  const handleRequestRole = () => {
    socket?.emit('solicitar_papel_sorteador', { roomId });
    setSolicitacaoEnviada(true);
  };
  const handleResponseToRequest = (aprovado: boolean) => {
    if (solicitacaoPendente) {
      socket?.emit('responder_solicitacao_de_papel', {
        roomId,
        aprovado,
        idDoSolicitante: solicitacaoPendente.socketId,
      });
      setSolicitacaoPendente(null);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Sorteio de Números</h1>
      <p>Seu ID de usuário: <strong>{userId.substring(0, 8)}</strong> | Seu papel: <strong>{role}</strong></p>

      {role === 'ESPECTADOR' && (
        <button onClick={handleRequestRole} disabled={solicitacaoEnviada}>
          {solicitacaoEnviada ? 'Pedido Enviado' : 'Quero ser o Sorteador'}
        </button>
      )}

      {role === 'SORTEADOR' && (
        <div style={{ border: '1px solid #ccc', padding: 10, margin: '20px 0' }}>
          <h3>Painel do Sorteador</h3>
          {solicitacaoPendente && (
            <div style={{ border: '1px solid orange', padding: 10, marginBottom: 10 }}>
              <p>O usuário {solicitacaoPendente.userId.substring(0,8)} quer ser o sorteador.</p>
              <button onClick={() => handleResponseToRequest(true)} style={{ marginRight: 5 }}>Aprovar</button>
              <button onClick={() => handleResponseToRequest(false)}>Recusar</button>
            </div>
          )}
          <button onClick={handleDraw}>Sortear Número</button>
          <label style={{ marginLeft: 10 }}>
            <input type="checkbox" checked={keepSorteador} onChange={(e) => setKeepSorteador(e.target.checked)} />
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
            {role === 'SORTEADOR' && papel === 'ESPECTADOR' && (
              <button onClick={() => handleTransferRole(socketId)} style={{ marginLeft: 15 }}>
                Tornar Sorteador (Direto)
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
