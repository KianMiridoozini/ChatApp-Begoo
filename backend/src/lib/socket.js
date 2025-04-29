import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";


const app = express()
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
    },
});

export function getRecieverSocketId(userId) {
    return userSocketMap[userId];
}
// used to store online users
const userSocketMap = {};

io.on("connection", async (socket) => {
    console.log("A user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) {
        userSocketMap[userId] = socket.id;
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // Emit full user list (no exclusion) to all clients
    try {
        const users = await User.find().select("-password");
        io.emit("usersUpdated", users);
    } catch (err) {
        console.error("Error emitting usersUpdated:", err);
    }

    socket.on("disconnect", async () => {
        console.log("A user disconnected", socket.id);
        delete userSocketMap[userId];
        if (userId) {
            try {
                await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
            } catch (err) {
                console.error("Error updating lastSeen on disconnect:", err);
            }
        }
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
        // Emit updated user list again (no exclusion)
        try {
            const users = await User.find().select("-password");
            io.emit("usersUpdated", users);
        } catch (err) {
            console.error("Error emitting usersUpdated:", err);
        }
    });

    // Typing events
    socket.on("typing", ({ to }) => {
        const recieverSocketId = userSocketMap[to];
        if (recieverSocketId) {
            io.to(recieverSocketId).emit("typing", { from: userId });
        }
    });
    socket.on("stopTyping", ({ to }) => {
        const recieverSocketId = userSocketMap[to];
        if (recieverSocketId) {
            io.to(recieverSocketId).emit("stopTyping", { from: userId });
        }
    });
}
)

export { io, app, server };