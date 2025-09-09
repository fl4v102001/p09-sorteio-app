// socket.js
import { getOrCreateUserId } from './utils/userId';
import { io } from 'socket.io-client';


export const socket = io('http://localhost:3000'); // ou a porta do seu backendconst userId = getOrCreateUserId();

socket.emit('joinRoom', { roomId: 'abc123', userId });