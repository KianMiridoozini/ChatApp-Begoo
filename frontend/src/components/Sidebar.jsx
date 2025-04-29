import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, X } from "lucide-react";

const Sidebar = ({ open, setOpen }) => {
    const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading, unread } = useChatStore();
    const { onlineUsers, authUser } = useAuthStore();

    useEffect(() => {
        getUsers();
        // Subscribe to real-time user updates
        useChatStore.getState().subscribeToUsers();
        return () => {
            useChatStore.getState().unsubscribeFromUsers();
        };
    }, [getUsers]);

    // Sort users: online first, then offline
    const filteredUsers = users
        .filter((user) => user._id !== authUser?._id)
        .sort((a, b) => {
            const aOnline = onlineUsers.includes(a._id);
            const bOnline = onlineUsers.includes(b._id);
            if (aOnline === bOnline) return a.fullName.localeCompare(b.fullName);
            return bOnline - aOnline; // online first
        });

    if (isUsersLoading) return <SidebarSkeleton />;

    // Mobile overlay styles
    return (
        <>
            {/* Overlay for mobile */}
            <div
                className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 lg:hidden ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setOpen(false)}
            />
            <aside
                className={`fixed z-50 top-0 left-0 h-full w-64 bg-base-100 border-r border-base-300 flex flex-col transition-transform duration-200 lg:static lg:w-72 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} shadow-lg lg:shadow-none`}
            >
                <div className="border-b border-base-300 w-full p-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="size-6" />
                        <span className="font-medium hidden lg:block">Contacts</span>
                    </div>
                    {/* Close button for mobile */}
                    <button className="lg:hidden p-1" onClick={() => setOpen(false)}>
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto w-full py-3 flex-1">
                    {filteredUsers.map((user) => (
                        <button
                            key={user._id}
                            onClick={() => {
                                setSelectedUser(user);
                                setOpen(false); // close sidebar on mobile after selecting
                            }}
                            className={`
                                w-full p-3 flex items-center gap-3
                                hover:bg-base-300 transition-colors
                                ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                            `}
                        >
                            <div className="relative mx-auto lg:mx-0">
                                <img
                                    src={user.profilePic || "/avatar.png"}
                                    alt={user.name}
                                    className="size-12 object-cover rounded-full"
                                />
                                {onlineUsers.includes(user._id) && (
                                    <span
                                        className="
                                        absolute bottom-0 right-0 size-3 
                                        bg-green-500 rounded-full ring-2 ring-zinc-900"
                                    />
                                )}
                            </div>
                            {/* Show user info on all screens (not just lg) */}
                            <div className="flex flex-col min-w-0 text-left flex-1">
                                <div className="flex items-center gap-2">
                                    <div className="font-medium truncate text-sm sm:text-base">{user.fullName}</div>
                                    {unread[user._id] && (
                                        <span
                                            className="flex min-w-[18px] h-4 px-1 bg-primary text-xs text-white rounded-full ring-2 ring-base-100 animate-pulse ml-1 items-center justify-center"
                                            title="Unread messages"
                                        >
                                            {unread[user._id] > 9 ? '9+' : unread[user._id]}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs sm:text-sm text-zinc-400">
                                    {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                                </div>
                            </div>
                        </button>
                    ))}
                    {filteredUsers.length === 0 && (
                        <div className="text-center text-zinc-500 py-4">No users found</div>
                    )}
                </div>
            </aside>
        </>
    )
}

export default Sidebar