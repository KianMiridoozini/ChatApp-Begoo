import { useChatStore } from "../store/useChatStore";
import { useState, useCallback, useRef, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";


const ChatContainer = () => {
    const {
        messages,
        getMessages,
        isMessagesLoading,
        selectedUser,
        subscribeToMessages,
        unsubscribeFromMessages,
        unread,
        setSelectedUser,
        markMessageRead,
        lastSeenMessage
    } = useChatStore();
    const { authUser } = useAuthStore();
    const [isAtBottom, setIsAtBottom] = useState(true);
    const messageContainerRef = useRef(null);
    const messageEndRef = useRef(null);
    const [observedMessages, setObservedMessages] = useState({});

    // Add a flag to track if initial scroll has been done
    const [initialScrollDone, setInitialScrollDone] = useState(false);
    // Add a ref to track the last message list length to know when new messages arrive
    const prevMessagesLengthRef = useRef(0);
    
    // Helper to check if scrolled to bottom
    const checkAtBottom = useCallback(() => {
        const el = messageContainerRef.current;
        if (!el) return false;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    }, []);

    // On scroll, update isAtBottom
    const handleScroll = () => {
        setIsAtBottom(checkAtBottom());
    };

    // When messages change, decide whether to scroll based on who sent the last message
    useEffect(() => {
        if (!messages || !selectedUser || messages.length === 0) return;
        
        const wasAtBottom = isAtBottom;
        const messagesLengthIncreased = messages.length > prevMessagesLengthRef.current;
        prevMessagesLengthRef.current = messages.length;
        
        // Don't scroll if this is just initial load and we haven't scrolled yet
        if (!initialScrollDone) return;
        
        // If new messages arrived and we were at the bottom, OR the last message is from us, scroll to bottom
        if ((messagesLengthIncreased && wasAtBottom) || 
            (messagesLengthIncreased && messages[messages.length - 1].senderId === authUser._id)) {
            setTimeout(() => {
                if (messageEndRef.current) {
                    messageEndRef.current.scrollIntoView({ behavior: "instant" });
                }
            }, 0);
        }
    }, [messages, selectedUser, isAtBottom, authUser._id, initialScrollDone]);
    
    // Immediate initial scroll with no animation when first opening a chat
    useEffect(() => {
        if (!messages || !selectedUser || messages.length === 0 || initialScrollDone) return;
        
        // Use requestAnimationFrame for better synchronization with browser rendering
        requestAnimationFrame(() => {
            // Always scroll to bottom on initial load
            if (messageEndRef.current) {
                // Use direct DOM manipulation for truly instant scroll with no animation
                const container = messageContainerRef.current;
                if (container) {
                    container.scrollTop = container.scrollHeight;
                    setInitialScrollDone(true);
                }
            }
        });
    }, [messages, selectedUser, initialScrollDone]);

    // Reset initialScrollDone when changing chats
    useEffect(() => {
        setInitialScrollDone(false);
        prevMessagesLengthRef.current = 0;
    }, [selectedUser?._id]);

    // Clear unread if at bottom and there are unread messages
    useEffect(() => {
        if (
            isAtBottom &&
            selectedUser &&
            unread[selectedUser._id]
        ) {
            setSelectedUser(selectedUser); // this will clear unread and call backend
        }
    }, [isAtBottom, selectedUser, unread, setSelectedUser]);

    // When new messages arrive, scroll to bottom if already at bottom
    useEffect(() => {
        if (isAtBottom && messageEndRef.current && messages) {
            messageEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isAtBottom]);

    useEffect(() => {
        getMessages(selectedUser._id);
        subscribeToMessages();
        return () => unsubscribeFromMessages();
    }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

    // Observe unread messages from the other user
    useEffect(() => {
        if (!messages || !selectedUser) return;
        const observer = new window.IntersectionObserver((entries) => {
            entries.forEach(async (entry) => {
                const messageId = entry.target.getAttribute("data-message-id");
                if (
                    entry.isIntersecting &&
                    messageId &&
                    !observedMessages[messageId]
                ) {
                    setObservedMessages((prev) => ({ ...prev, [messageId]: true }));
                    // Mark as read in backend
                    await axiosInstance.post("/messages/mark-read", { messageIds: [messageId] });
                    // Decrement unread in frontend
                    if (selectedUser) markMessageRead(selectedUser._id);
                }
            });
        }, { threshold: 0.7 });
        // Observe only unread messages from the other user
        messages.forEach((msg) => {
            if (
                msg.senderId === selectedUser._id &&
                !msg.read
            ) {
                const el = document.querySelector(`[data-message-id='${msg._id}']`);
                if (el) observer.observe(el);
            }
        });
        return () => observer.disconnect();
    }, [messages, selectedUser, observedMessages, markMessageRead]);

    if (isMessagesLoading) {
        return (
            <div className="flex-1 flex flex-col overflow-auto">
                <ChatHeader />
                <MessageSkeleton />
                <MessageInput />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-auto">
            <ChatHeader />

            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messageContainerRef} onScroll={handleScroll}>
                {messages.map((message) => {
                    const isOwn = message.senderId === authUser._id;
                    const isLastSeen =
                        isOwn &&
                        lastSeenMessage[selectedUser._id] === message._id;
                    return (
                        <div
                            key={message._id}
                            data-message-id={message._id}
                            className={`chat ${isOwn ? "chat-end" : "chat-start"}`}
                            ref={messageEndRef}
                        >
                            <div className=" chat-image avatar">
                                <div className="size-10 rounded-full border">
                                    <img
                                        src={
                                            isOwn
                                                ? authUser.profilePic || "/avatar.png"
                                                : selectedUser.profilePic || "/avatar.png"
                                        }
                                        alt="profile pic"
                                    />
                                </div>
                            </div>
                            <div className="chat-header mb-1">
                                <time className="text-xs opacity-50 ml-1">
                                    {formatMessageTime(message.createdAt)}
                                </time>
                            </div>
                            <div className="chat-bubble flex flex-col relative">
                                {message.image && (
                                    <img
                                        src={message.image}
                                        alt="Attachment"
                                        className="sm:max-w-[200px] rounded-md mb-2"
                                    />
                                )}
                                {message.text && <p>{message.text}</p>}
                                {isLastSeen && (
                                    <span
                                        className="absolute left-full ml-2 bottom-0 translate-y-full text-xs text-primary animate-fade-in"
                                        style={{ minWidth: 40 }}
                                    >
                                        Seen
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <MessageInput />
        </div>
    );
};
export default ChatContainer;