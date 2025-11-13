import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';

const generateRefreshToken = async (userId: string): Promise<string> => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET as string, { expiresIn: '7d' });

  await User.updateOne({ _id: userId }, { refresh_token: token });

  return token;
};

export default generateRefreshToken;

