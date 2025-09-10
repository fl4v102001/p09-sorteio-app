import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// --- Tipos ---
type UserRole = 'SORTEADOR' | 'ESPECTADOR';
interface User { socketId: string; userId: string; role: UserRole; }
interface RequesterInfo { socketId: string; userId: string; }

// --- Tipos de Eventos do Socket ---
interface ServerToClientEvents {
  roleUpdate: (users: User[]) => void;
  numberDrawn: (number: number) => void;
  receber_solicitacao_de_papel: (requester: RequesterInfo) => void;
  solicitacao_recusada: () => void;
}

interface ClientToServerEvents {
  joinRoom: (data: { roomId: string; userId: string }) => void;
  drawNumber: (data: { roomId: string; keepSorteador: boolean }) => void;
  transferRole: (data: { roomId: string; targetSocketId: string }) => void;
  solicitar_papel_sorteador: (data: { roomId: string }) => void;
  responder_solicitacao_de_papel: (data: { roomId: string; aprovado: boolean; idDoSolicitante: string; }) => void;
}

// --- Componente Badge de Papel ---
const RoleBadge = ({ role }: { role: UserRole }) => (
  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${role === 'SORTEADOR' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-600 text-gray-200'}`}>
    {role}
  </span>
);

// --- Componente Principal ---
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

  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [userId]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => socket.emit('joinRoom', { roomId, userId });
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
    const onReceberSolicitacao = (req: RequesterInfo) => setSolicitacaoPendente(req);
    const onSolicitacaoRecusada = () => setSolicitacaoEnviada(false);

    socket.on('connect', onConnect);
    socket.on('roleUpdate', onRoleUpdate);
    socket.on('numberDrawn', onNumberDrawn);
    socket.on('receber_solicitacao_de_papel', onReceberSolicitacao);
    socket.on('solicitacao_recusada', onSolicitacaoRecusada);

    return () => {
      socket.off('connect', onConnect);
      socket.off('roleUpdate', onRoleUpdate);
      socket.off('numberDrawn', onNumberDrawn);
      socket.off('receber_solicitacao_de_papel', onReceberSolicitacao);
      socket.off('solicitacao_recusada', onSolicitacaoRecusada);
    };
  }, [socket, userId, solicitacaoPendente]);

  const handleDraw = () => socket?.emit('drawNumber', { roomId, keepSorteador });
  const handleTransferRole = (targetSocketId: string) => socket?.emit('transferRole', { roomId, targetSocketId });
  const handleRequestRole = () => {
    socket?.emit('solicitar_papel_sorteador', { roomId });
    setSolicitacaoEnviada(true);
  };
  const handleResponseToRequest = (aprovado: boolean) => {
    if (solicitacaoPendente) {
      socket?.emit('responder_solicitacao_de_papel', { roomId, aprovado, idDoSolicitante: solicitacaoPendente.socketId });
      setSolicitacaoPendente(null);
    }
  };

  const baseButtonClasses = "px-4 py-2 font-semibold rounded-lg shadow-md transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-75";
  const primaryButtonClasses = `bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 ${baseButtonClasses}`;
  const secondaryButtonClasses = `bg-gray-600 text-gray-200 hover:bg-gray-700 focus:ring-gray-500 ${baseButtonClasses}`;
  const disabledButtonClasses = "disabled:bg-gray-500 disabled:cursor-not-allowed disabled:transform-none";

  return (
    <main className="bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-3xl bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 space-y-6">
        
        <header className="text-center">
          <h1 className="text-4xl font-bold">Sorteio de Números</h1>
          <p className="text-gray-400 mt-2">Você é <RoleBadge role={role} /> (ID: {userId.substring(0, 8)})</p>
        </header>

        {role === 'ESPECTADOR' && (
          <div className="text-center">
            <button onClick={handleRequestRole} disabled={solicitacaoEnviada} className={`${primaryButtonClasses} ${disabledButtonClasses}`}>
              {solicitacaoEnviada ? 'Pedido Enviado' : 'Quero ser o Sorteador'}
            </button>
          </div>
        )}

        {role === 'SORTEADOR' && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-4">
            {solicitacaoPendente && (
              <div className="bg-orange-900/50 border border-orange-500 rounded-lg p-3 text-center">
                <p>O usuário <span className="font-bold">{solicitacaoPendente.userId.substring(0,8)}</span> quer ser o sorteador.</p>
                <div className="mt-3 space-x-3">
                  <button onClick={() => handleResponseToRequest(true)} className={`bg-green-600 hover:bg-green-700 focus:ring-green-500 ${baseButtonClasses}`}>Aprovar</button>
                  <button onClick={() => handleResponseToRequest(false)} className={`bg-red-600 hover:bg-red-700 focus:ring-red-500 ${baseButtonClasses}`}>Recusar</button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-4">
              <button onClick={handleDraw} className={primaryButtonClasses}>Sortear Número</button>
              <label className="flex items-center gap-2 text-gray-300">
                <input type="checkbox" checked={keepSorteador} onChange={(e) => setKeepSorteador(e.target.checked)} className="form-checkbox bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500" />
                Manter como sorteador
              </label>
            </div>
          </div>
        )}

        {number !== null && (
          <div className="text-center">
            <h2 className="text-lg text-gray-400">Último número sorteado:</h2>
            <p className="text-8xl font-bold text-yellow-400 my-4">{number}</p>
          </div>
        )}

        <div>
          <h3 className="text-xl font-semibold mb-3">Participantes na Sala ({users.length})</h3>
          <ul className="space-y-2">
            {users.map(({ socketId, userId: uid, role: papel }) => (
              <li key={socketId} className={`flex justify-between items-center p-3 rounded-lg ${uid === userId ? 'bg-blue-900/50' : 'bg-gray-900/50'}`}>
                <div className="flex items-center gap-3">
                  <RoleBadge role={papel} />
                  <span className="font-medium">{uid === userId ? 'Você' : `Usuário ${uid.substring(0, 8)}`}</span>
                </div>
                {role === 'SORTEADOR' && papel === 'ESPECTADOR' && (
                  <button onClick={() => handleTransferRole(socketId)} className={`${secondaryButtonClasses} !py-1 !px-2 !text-xs`}>
                    Tornar Sorteador
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </main>
  );
}

export default App;