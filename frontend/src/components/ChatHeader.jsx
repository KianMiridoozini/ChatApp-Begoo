import { X } from "lucide-react";
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

function formatLastSeen(date) {
    if (!date) return "a while ago";
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return d.toLocaleString();
}

const ChatHeader = () => {
    const { selectedUser, setSelectedUser } = useChatStore();
    const { onlineUsers } = useAuthStore();
    const { isTyping, subscribeToTyping, unsubscribeFromTyping } = useChatStore();
    useEffect(() => {
        subscribeToTyping();
        return () => unsubscribeFromTyping();
    }, [selectedUser?._id, subscribeToTyping, unsubscribeFromTyping]);
    const isOnline = onlineUsers.includes(selectedUser._id);
    return (
        <div className="p-2.5 border-b border-base-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="avatar">
                        <div className="size-10 rounded-full relative">
                            <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                        </div>
                    </div>

                    {/* User info */}
                    <div>
                        <h3 className="font-medium">{selectedUser.fullName}</h3>
                        <p className="text-sm text-base-content/70">
                            {isTyping
                                ? "Typing..."
                                : isOnline
                                    ? "Online"
                                    : selectedUser.lastSeen
                                        ? `Last seen ${formatLastSeen(selectedUser.lastSeen)}`
                                        : "Offline"}
                        </p>
                    </div>
                </div>

                {/* Close button */}
                <button onClick={() => setSelectedUser(null)}>
                    <X />
                </button>
            </div>
        </div>
    );
};
export default ChatHeader;