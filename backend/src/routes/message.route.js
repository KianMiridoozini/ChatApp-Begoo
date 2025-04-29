import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getUsersForSidebar, getMessages, sendMessage, clearUnread, markMessagesRead } from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage)
router.post("/clear-unread", protectRoute, clearUnread);
router.post("/mark-read", protectRoute, markMessagesRead);

export default router;