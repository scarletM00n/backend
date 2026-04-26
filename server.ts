import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan' ;
import path from 'path';
import authRouter from './routes/auth.route';
import homeRouter from './routes/home.route';
import discoverRouter from './routes/discover.route';
import productRouter from './routes/product.route';
import cartRouter from './routes/cart.route';
import addressRouter from './routes/address.route';
import paymentRouter from './routes/payment.route';
import orderRouter from './routes/order.route';
import wishlistRouter from './routes/wishlist.route';
import adminRouter from './routes/admin.route';
import deliveryRouter from './routes/delivery.route';
import chatbotRouter from './routes/chatbot.route';
import { initSocket } from './realtime/socket';

dotenv.config({ override: true });

const app = express();
const server = http.createServer(app);
const resolvedPort = Number(process.env.PORT || 4001);
const PORT = resolvedPort === 4000 ? 4001 : resolvedPort;
const MAX_PORT_ATTEMPTS = 10;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended :true})) ;
app.use(morgan("dev"));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// apis

app.use('/api/auth' , authRouter);
app.use('/api/home' , homeRouter);
app.use('/api/discover' , discoverRouter) ;
app.use('/api/products' , productRouter) ;
app.use('/api/cart' , cartRouter) ;
app.use('/api/address' , addressRouter) ;
app.use('/api/payment' , paymentRouter) ;
app.use('/api/orders' , orderRouter) ;
app.use('/api/wishlist' , wishlistRouter) ;
app.use('/api/admin', adminRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/chatbot', chatbotRouter);

initSocket(server);

let activePort = PORT;
let attemptsLeft = MAX_PORT_ATTEMPTS;

server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && attemptsLeft > 1) {
            attemptsLeft -= 1;
            activePort += 1;
            server.listen(activePort);
            return;
      }

      throw error;
});

server.listen(activePort, () => {
      console.log(`server running at => http://localhost:${activePort} ;`);
});


export default app;