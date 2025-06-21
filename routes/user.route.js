import { Router } from "express";
import {
  getUserProfile,
  loginUser,
  registerUser,
  updateUserProfileAddresses,
} from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.js";

const userRouter = Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.get("/profile", authenticate, getUserProfile);
userRouter.put("/profile", authenticate, updateUserProfileAddresses); 

export default userRouter;