const express = require('express');
const app = express();
const mongoose = require('mongoose');
const amqp = require('amqplib')
const isAuthenticated = require('../Customer-Service/authenticated');
const Order = require('./order.model');
const dotenv = require('dotenv');
const helmet = require('helmet');
const xss = require('xss-clean');
const cors  =require('cors');
const morgan = require('morgan');
dotenv.config();
const PORT = process.env.PORT_ONE || 9090;

app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
app.use(xss());

//UseFull Variables
var connection, channel


//Connecting With Productservice Database 
//Note:- Please Update the mongoURL as it suits you with Local or the MongoDB Atlas URL
mongoose.connect("mongodb://localhost:27017/orderservice", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Successfully connected to the database(OrderService)");
}).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
});



/**
 * Connects to the rabbitMQ Server and Creates a Queue for PRODUCT 
 */
async function connectRabbitMQ() {
    // Note:- Need to connect rabbitMQ Server, to access the Channel 
    try {
        const amqpServer = "amqp://localhost:5672";
        connection =  amqp.connect(amqpServer);
        channel = await connection.createChannel();
        await channel.assertQueue("ORDER");
    } catch (err) {
        console.log(err);
    }
}
connectRabbitMQ().then(() => {
    try {
    //Consuming Order Channel to get the Product details for the Order Creation
    channel.consume("ORDER", data => {
            const {
                products,
                userEmail
            } = JSON.parse(data.content);
            console.log('Consuming the Order Service', products);
            const newOrder = createOrder(products, userEmail)
            channel.ack(data)
    //Sending Order creation to as a Acknowledgment in teh Product channel
    channel.sendToQueue("PRODUCT", Buffer.from(JSON.stringify({ newOrder })));
       })

    } catch (error) {
        console.log(error);
    }
});


/**
 * Create Order
 * @param {products} Array Array of product IDs 
 * @param {userEmail} String User's email
 */
function createOrder(products, userEmail) {
    try {
        let total_price = 0;
        products.forEach((product) => { total_price += product.price });
        const createOrder = new Order({
            products,
            total: total_price,
            user: userEmail
        });
        createOrder.save();
        console.log('OrderCreation', createOrder);
        return createOrder

    } catch (err) {
        console.log(err);
    }


}



/**
 * Listens the server at Proviced Port 
 */

app.listen(PORT, () => {
    console.log(`Order-Service at ${PORT}`);
})