import { Router } from 'express';
import { addToCart, getCart, updateCartItem, removeCartItem, clearCart } from '../controllers/cart.controller.js';
import { authenticate } from '../middlewares/auth.js';

const cartRouter = Router();

cartRouter.get('/', authenticate, getCart);
cartRouter.post('/add', authenticate, addToCart);
cartRouter.put('/item/:productId', authenticate, updateCartItem);
cartRouter.delete('/item/:productId', authenticate, removeCartItem);
cartRouter.delete('/clear', authenticate, clearCart);

export default cartRouter;

