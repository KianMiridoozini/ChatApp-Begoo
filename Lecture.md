# Demo: Real-time Chat with Socket.io

How messages travel instantly in this app:

**1. Setup (Backend - `backend/src/lib/socket.js`)**

*   Start a Socket.io server. It listens for incoming connections.
    ```javascript
    // backend/src/lib/socket.js
    const server = http.createServer(app);
    const io = new Server(server, { /* ... */ });
    ```
*   Keep track of who's online (`userSocketMap`: links `userId` to their connection `socket.id`). This map is vital for targeting specific users.
    ```javascript
    // backend/src/lib/socket.js
    const userSocketMap = {}; // { userId: socketId }
    io.on("connection", (socket) => {
        const userId = socket.handshake.query.userId;
        if (userId) userSocketMap[userId] = socket.id;
        // ...
    });
    export function getRecieverSocketId(userId) { return userSocketMap[userId]; }
    ```

**2. The Handshake & Connection (Frontend -> Backend)**

*   **Frontend (`frontend/src/store/useAuthStore.js`) initiates:** When a user logs in, the client attempts to establish a WebSocket connection.
    ```javascript
    // frontend/src/store/useAuthStore.js -> connectSocket
    const socket = io(BASE_URL, { query: { userId: authUser._id } });
    socket.connect();
    ```
*   **HTTP Upgrade:** This starts as a standard HTTP request. The client asks the server to upgrade the connection to a WebSocket.
*   **Backend (`socket.js`) accepts:** If the server agrees (and CORS allows it), the connection is upgraded. A persistent, two-way WebSocket tunnel is now open between *this specific client* and the server.
*   **Identification:** The `userId` sent in the query helps the backend map this new persistent connection (`socket.id`) to the correct user in `userSocketMap`.

**3. Sending a Message (Real-time Part)**

*   **Frontend (`useChatStore.js` -> `sendMessage`):**
    1.  **Save Message (HTTP):** Sends message details via **HTTP POST** (`/api/messages/send/...`). This is a *separate, standard request* just for database persistence.
        ```javascript
        // frontend/src/store/useChatStore.js -> sendMessage
        await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
        ```
    2.  (Optimistic UI update happens here)
*   **Backend (`message.controller.js` -> `sendMessage`):**
    1.  Saves message to DB (after the HTTP request arrives).
    2.  Finds recipient's `socket.id` using `getRecieverSocketId`.
    3.  **Push via WebSocket:** If recipient is online, it uses the *existing WebSocket connection* established in step 2 to send the message directly. **No new HTTP request is needed for this.**
        ```javascript
        // backend/src/controllers/message.controller.js -> sendMessage
        if (recieverSocketId) {
            // Send directly over the open WebSocket tunnel
            io.to(recieverSocketId).emit("newMessage", newMessage);
        }
        ```

**4. Receiving a Message (Real-time Part)**

*   **Frontend (`useChatStore.js` -> `subscribeToGlobalEvents`):**
    *   The client is constantly listening on its *existing WebSocket connection*.
        ```javascript
        // frontend/src/store/useChatStore.js -> subscribeToGlobalEvents
        // 'socket' is the persistent connection established earlier
        socket.on("newMessage", (newMessage) => {
            // ... update UI ...
        });
        ```
    *   When the `newMessage` event arrives *through the WebSocket tunnel* (pushed by the server in step 3.3), the listener fires and updates the UI.

**Key Difference:**

*   **Handshake:** Initial HTTP request upgraded to a persistent WebSocket.
*   **Saving:** Standard HTTP POST request to save data.
*   **Real-time:** Messages are *pushed* from server to client (and client to server for things like 'typing') over the *already open WebSocket connection* using `emit` and `on`, without needing new HTTP requests for each message.
