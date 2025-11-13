import jwt from 'jsonwebtoken';

const generateAccessToken = async (userId: string): Promise<string> => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
  return token;
};

export default generateAccessToken;

