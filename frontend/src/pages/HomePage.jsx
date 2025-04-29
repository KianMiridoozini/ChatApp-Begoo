import React from 'react'
import { useChatStore } from '../store/useChatStore'
import Sidebar from '../components/Sidebar'
import NoChatSelected from '../components/NoChatSelected'
import ChatContainer from '../components/ChatContainer'

const HomePage = ({ sidebarOpen, setSidebarOpen }) => {
    const {selectedUser} = useChatStore()
    return (
        <div className="h-screen bg-base-200">
            <div className="flex items-center justify-center pt-16 sm:pt-20 px-1 sm:px-4">
                <div className="bg-base-100 shadow-cl rounded-lg max-w-6xl w-full h-[calc(100vh-5rem)] sm:h-[calc(100vh-8rem)]">
                    <div className="flex h-full rounded-lg overflow-hidden relative">
                        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
                        <div className={`flex flex-1 h-full ${sidebarOpen ? 'blur-sm pointer-events-none select-none' : ''} transition-all duration-200`}>
                            {!selectedUser ? <NoChatSelected/> : <ChatContainer/>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HomePage