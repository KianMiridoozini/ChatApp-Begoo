import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getRecieverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
        res.status(200).json(filteredUsers);
    } catch (error) {
        console.error("Error fetching users for sidebar:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getMessages = async (req, res) => {

    try {
        const { id: userToChatId } = req.params
        const myId = req.user._id
        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId }
            ]
        })
        res.status(200).json(messages)
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const sendMessage = async (req, res) => {
    try {
        const { text, image } = req.body
        const { id: receiverId } = req.params
        const senderId = req.user._id

        let imageUrl;
        if (image) {
            const uploadedResponse = await cloudinary.uploader.upload(image)
            imageUrl = uploadedResponse.secure_url
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl
        })
        await newMessage.save();

        // Increment unread count for receiver from sender (no $addToSet for Map fields)
        await User.findByIdAndUpdate(receiverId, {
            $inc: { [`unreadFrom.${senderId}`]: 1 }
        });
        // Fetch updated unread count for this sender
        const updatedReceiver = await User.findById(receiverId);
        const unreadCount = updatedReceiver.unreadFrom.get(senderId.toString()) || 1;
        // Emit socket event for unread update with correct count
        const recieverSocketId = getRecieverSocketId(receiverId)
        if (recieverSocketId) {
            io.to(recieverSocketId).emit("unreadUpdate", { senderId, count: unreadCount });
            io.to(recieverSocketId).emit("newMessage", newMessage)
        }
        res.status(200).json(newMessage)
    } catch (error) {
        console.error("Error in sendMessage controller:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const clearUnread = async (req, res) => {
    try {
        const userId = req.user._id;
        const { senderId } = req.body;
        await User.findByIdAndUpdate(userId, {
            $set: { [`unreadFrom.${senderId}`]: 0 }
        });
        // Emit socket event for unread clear
        const socketId = getRecieverSocketId(userId);
        if (socketId) {
            io.to(socketId).emit("unreadUpdate", { senderId, count: 0 });
        }
        res.status(200).json({ message: "Unread cleared" });
    } catch (error) {
        console.error("Error clearing unread status:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const markMessagesRead = async (req, res) => {
    try {
        const { messageIds } = req.body; // array of message IDs
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: "No message IDs provided" });
        }
        // Find all messages to be marked as read
        const messages = await Message.find({ _id: { $in: messageIds } });
        // Mark messages as read
        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $set: { read: true, seenAt: new Date() } }
        );
        // Decrement unreadFrom for each sender/receiver pair and emit socket event
        for (const msg of messages) {
            const user = await User.findByIdAndUpdate(msg.receiverId, {
                $inc: { [`unreadFrom.${msg.senderId}`]: -1 }
            }, { new: true });
            // Clean up: if count is 0 or less, remove the key
            const count = user.unreadFrom.get(msg.senderId.toString()) || 0;
            if (count <= 0) {
                user.unreadFrom.delete(msg.senderId.toString());
                await user.save();
            }
            // Emit socket event for real-time update
            const socketId = getRecieverSocketId(msg.receiverId.toString());
            if (socketId) {
                io.to(socketId).emit("unreadUpdate", { senderId: msg.senderId, count: Math.max(0, count) });
            }
        }
        // Find the latest seen message for this chat (from sender to receiver)
        const lastSeenMessage = await Message.findOne({
            senderId: { $in: messages.map(m => m.senderId) },
            receiverId: { $in: messages.map(m => m.receiverId) },
            read: true,
            seenAt: { $ne: null }
        }).sort({ seenAt: -1 });
        if (lastSeenMessage) {
            // Notify the sender in real-time
            const senderSocketId = getRecieverSocketId(lastSeenMessage.senderId.toString());
            if (senderSocketId) {
                io.to(senderSocketId).emit("messageSeen", {
                    messageId: lastSeenMessage._id,
                    seenAt: lastSeenMessage.seenAt,
                    by: lastSeenMessage.receiverId
                });
            }
        }
        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        console.error("Error marking messages as read:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};