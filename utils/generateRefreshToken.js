import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const generateRefreshToken = async (userId) => {
  const token = jwt.sign(
    { id: userId },
    process.env.SECRET_KEY_REFRESH_TOKEN,
    { expiresIn: "7d" }
  );

  const updateRefreshTokenUser = await User.updateOne(
    { _id: userId },
    { refresh_token: token }
  );

  return token;
};

export default generateRefreshToken;