import jwt from "jsonwebtoken";

const generateAccessToken = async (userId) => {
  const token = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return token;
};

export default generateAccessToken;