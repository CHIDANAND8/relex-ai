from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Keeps track of connected WebSocket sessions
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"🔌 Notification Connection: Connected client (Total: {len(self.active_connections)})")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"🔌 Notification Connection: Disconnected client (Total: {len(self.active_connections)})")

    async def broadcast(self, message: dict):
        # Push messages concurrently to all dashboard listeners
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                # Silently catch closed or broken pipes
                pass

# Global shared instance
notification_manager = ConnectionManager()
