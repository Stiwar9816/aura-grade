import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
// Socket.io
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) client.join(userId); // El estudiante se une a una sala privada con su ID
  }

  notifyStudent(userId: string, data: any) {
    this.server.to(userId).emit('submissionStatusUpdated', data);
  }
}
