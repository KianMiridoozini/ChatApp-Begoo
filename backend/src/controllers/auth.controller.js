import cloudinary from "../lib/cloudinary.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
export const signup = async (req, res) => {
    const { email, fullName, password } = req.body;
    try {
        if (!email || !fullName || !password) {
            return res.status(400).json({
                message: "Please fill all the fields",
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters long",
            });
        }
        const user = await User.findOne({ email })
        if (user) {
            return res.status(400).json({
                message: "User already exists",
            });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt)
        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
        });
        if (newUser) {
            generateToken(newUser._id, res);
            await newUser.save();
            res.status(201).json({
                _id: newUser._id,
                email: newUser.email,
                fullName: newUser.fullName,
                profilePic: newUser.profilePic,
            });
        }
        else {
            return res.status(400).json({
                message: "User not created",
            });
        }
    } catch (error) {
        // console.log("Error in signup controller", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        })
    }
};
export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "invalid credentials",
            });
        }
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({
                message: "invalid credentials",
            });
        }
        generateToken(user._id, res);
        res.status(200).json({
            _id: user._id,
            email: user.email,
            fullName: user.fullName,
            profilePic: user.profilePic,
        });
    } catch (error) {
        // console.log("Error in login controller", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        })
    }
};
export const logout = async (req, res) => {
    try {
        if (req.user && req.user._id) {
            await User.findByIdAndUpdate(req.user._id, { lastSeen: new Date() });
        }
        res.cookie("jwt", "", { maxAge: 0 });
        res.status(200).json({
            message: "User logged out",
        });
    } catch (error) {
        // console.log("Error in logout controller", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        })
    }
};

export const updateProfile = async (req, res) => {

    try {
        const { profilePic } = req.body;
        const userId = req.user._id
        if (!profilePic) {
            return res.status(400).json({
                message: "Please provide a profile picture",
            });
        }
        const uploadedResponse = await cloudinary.uploader.upload(profilePic)
        const updatedUser = await User.findByIdAndUpdate(userId, { profilePic: uploadedResponse.secure_url }, { new: true })
        res.status(200).json(updatedUser)
    } catch (error) {
        // console.log("Error in updateProfile controller", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        })
    }
}

export const checkAuth = (req, res) => {

    try {
        res.status(200).json(req.user)
    } catch (error) {
        // console.log("Error in checkAuth controller", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        })
    }
}