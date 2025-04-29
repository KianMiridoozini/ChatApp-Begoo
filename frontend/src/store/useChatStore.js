import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";



export const useChatStore = create((set, get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    unread: {}, // { userId: true }
    isTyping: false,
    lastSeenMessage: {}, // { userId: messageId }
    setIsTyping: (val) => set({ isTyping: val }),
    setLastSeenMessage: (userId, messageId) => set((state) => ({
        lastSeenMessage: { ...state.lastSeenMessage, [userId]: messageId }
    })),
    subscribeToTyping: () => {
        const { selectedUser } = get();
        const { socket } = useAuthStore.getState();
        if (!selectedUser || !socket) return;
        socket.on("typing", ({ from }) => {
            if (from === selectedUser._id) set({ isTyping: true });
        });
        socket.on("stopTyping", ({ from }) => {
            if (from === selectedUser._id) set({ isTyping: false });
        });
    },
    unsubscribeFromTyping: () => {
        const { socket } = useAuthStore.getState();
        if (!socket) return;
        socket.off("typing");
        socket.off("stopTyping");
    },

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/messages/users");
            set({ users: res.data });
            // Always build unread map from unreadFrom for all users
            const { authUser } = useAuthStore.getState();
            const unread = {};
            
            // Only count messages where the current user is the RECEIVER
            res.data.forEach(user => {
                // Make sure we only count unread messages sent TO the current user
                if (user.unreadFrom && typeof user.unreadFrom === 'object') {
                    // The unreadFrom map contains counts of messages from each sender
                    // We need to check if there are any unread messages from this user to the current user
                    const unreadCount = user.unreadFrom[authUser._id];
                    if (unreadCount && unreadCount > 0) {
                        unread[user._id] = unreadCount;
                    }
                }
            });
            
            set({ unread });
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isUsersLoading: false });
        }
    },

    getMessages: async (userId) => {
        set({ isMessagesLoading: true });
        try {
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({ messages: res.data });
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    sendMessage: async (messageData) => {
        const { selectedUser, messages } = get();
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
            set({ messages: [...messages, res.data] });
        } catch (error) {
            toast.error(error.response.data.message);
        }
    },

    subscribeToMessages: () => {
        const { selectedUser } = get();
        if (!selectedUser) return;
        const socket = useAuthStore.getState().socket;
        const { authUser } = useAuthStore.getState();

        socket.on("newMessage", (newMessage) => {
            // Check if this message belongs to the current chat conversation
            const isPartOfCurrentChat = 
                (newMessage.senderId === selectedUser._id && newMessage.receiverId === authUser._id) || 
                (newMessage.receiverId === selectedUser._id && newMessage.senderId === authUser._id);
            
            // If it's part of current chat, add it to messages
            if (isPartOfCurrentChat) {
                set({ messages: [...get().messages, newMessage] });
            }
        });

        // Listen for messageSeen event
        socket.on("messageSeen", ({ messageId, by }) => {
            set((state) => ({
                lastSeenMessage: { ...state.lastSeenMessage, [by]: messageId }
            }));
        });
    },
    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        socket.off("newMessage");
    },

    setSelectedUser: (selectedUser) => {
        set((state) => {
            // Clear unread for this user
            const newUnread = { ...state.unread };
            if (selectedUser && newUnread[selectedUser._id]) {
                delete newUnread[selectedUser._id];
                // Notify backend to clear unread
                axiosInstance.post("/messages/clear-unread", { senderId: selectedUser._id });
            }
            return { selectedUser, unread: newUnread };
        });
    },

    subscribeToUsers: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.on("usersUpdated", (users) => {
            set({ users });
        });
    },
    unsubscribeFromUsers: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("usersUpdated");
    },

    markMessageRead: (senderId) => set((state) => {
        const unread = { ...state.unread };
        if (unread[senderId]) {
            unread[senderId] = Math.max(0, unread[senderId] - 1);
            if (unread[senderId] === 0) delete unread[senderId];
        }
        return { unread };
    }),

    subscribeToGlobalEvents: () => {
        const socket = useAuthStore.getState().socket;
        const { authUser } = useAuthStore.getState();
        if (!socket || !authUser) return;

        // Clear any existing newMessage listeners to prevent duplicates
        socket.off("newMessage");
        
        // Listen for new messages globally (from any user)
        socket.on("newMessage", (newMessage) => {
            // ONLY count messages where the current user is the receiver
            if (newMessage.receiverId === authUser._id && newMessage.senderId !== authUser._id) {
                const { selectedUser } = get();
                // Only count unread if the chat isn't currently selected
                if (!selectedUser || selectedUser._id !== newMessage.senderId) {
                    // Don't increment here - we'll rely on the unreadUpdate event
                    // which comes from the server with the correct count
                }
            }
        });
        
        // Clear any existing unreadUpdate listeners to prevent duplicates
        socket.off("unreadUpdate");

        // Listen for unreadUpdate events from the server - this is our source of truth
        socket.on("unreadUpdate", ({ senderId, count }) => {
            // NEVER show unread indicators for our own messages
            const { authUser } = useAuthStore.getState();
            if (senderId === authUser._id) return;
            
            // Debug logging to trace the values
            console.log(`Unread update from ${senderId}: count=${count}`);
            
            set((state) => {
                const newUnread = { ...state.unread };
                if (count > 0) {
                    newUnread[senderId] = count;
                } else {
                    delete newUnread[senderId];
                }
                return { unread: newUnread };
            });
        });

        // Clear any existing messageSeen listeners to prevent duplicates
        socket.off("messageSeen");
        
        // Listen for messageSeen event and persist the seen status
        socket.on("messageSeen", ({ messageId, by }) => {
            // Save seen message ID in localStorage for persistence across refreshes
            if (messageId) {
                const seenMessages = JSON.parse(localStorage.getItem('lastSeenMessages') || '{}');
                seenMessages[by] = messageId;
                localStorage.setItem('lastSeenMessages', JSON.stringify(seenMessages));
                
                set((state) => ({
                    lastSeenMessage: { ...state.lastSeenMessage, [by]: messageId }
                }));
            }
        });
    },

    // Initialize seen status from localStorage
    loadSeenMessages: () => {
        try {
            const savedSeenMessages = JSON.parse(localStorage.getItem('lastSeenMessages') || '{}');
            set({ lastSeenMessage: savedSeenMessages });
        } catch (e) {
            console.error("Error loading seen messages:", e);
        }
    },

    unsubscribeFromGlobalEvents: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("newMessage");
        socket.off("unreadUpdate");
        socket.off("messageSeen");
    },
}))