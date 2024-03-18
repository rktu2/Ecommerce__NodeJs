const express = require('express');
const app = express();
const mongoose = require('mongoose');
const amqp = require('amqplib')
const Product = require('./product.model');
const isAuthenticated = require('../Customer-Service/authenticated');
const dotenv = require('dotenv');
const helmet = require('helmet');
const xss = require('xss-clean');
const cors  =require('cors');
const morgan = require('morgan');
dotenv.config();


const PORT = process.env.PORT_ONE || 8080;
//Usefull variables
var connection, channel, order
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
app.use(xss());


//Connecting With Productservice Database 
//Note:- Please Update the mongoURL as it suits you with Local or the MongoDB Atlas URL
mongoose.connect("mongodb://localhost:27017/productservice", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Successfully connected to the database(ProductService)");
}).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
});


/**
 * Connects to the rabbitMQ Server and Creates a Queue for PRODUCT 
 */


async function connectRabbitMQ() {
    const amqpServer = "amqp://localhost:5672";
    let connection, channel;

    try {
        connection = await amqp.connect(amqpServer);
        channel = await connection.createChannel();
        await channel.assertQueue("PRODUCT");
        console.log("RabbitMQ connection established successfully.");
    } catch (error) {
        console.error("Error connecting to RabbitMQ:", error);
    } finally {
        if (channel) {
            await channel.close();
        }
        if (connection) {
            await connection.close();
        }
    }
}

connectRabbitMQ();




/**
 * Creates Product with Precheck of the Authetication
 * @param {name} String Name of the Product 
 * @param {description} String Name of the Product
 * @param {price} Number price of the Product
 */
app.post("/product/create", isAuthenticated, async (req, res) => {
   try{
    const { name, description, price ,stock} = req.body;
    const newProduct = Product({
        name, description, price , stock
    });
    newProduct.save()
    return res.json(newProduct)
    
   }catch(err){
    console.log(err);
   }
});
app.get("get/product", isAuthenticated , async(req, res) =>{
    try{
        const product = await Product.find();
        if(!product){
            return res.status(401).json({success:false , message:'product not found'})
        }
        return res.status(200).json({success:true , data:product , message:"list of product"});
    }catch(e){
        return res.status(500).json({success:false , message:e.message});
    }
})
app.get('get/ProductById/:id',isAuthenticated, async(req, res)=>{
    try{
        const product = await Product.findById(req.params.id);
        if(!product){
            return res.status(401).json({success:false , message:"product not found"});
        }
        return res.status(200).json({success:true , data:product , message:"Product Found"});
    }catch(e){
        return res.status(500).json({success:false , message:e.message});


    }
})
app.delete('delete/product/:id', isAuthenticated, async(req, res) =>{
    try{
        const product = await Product.findByIdAndRemove(req.params.id);
        if(!product){
            return res.status(401).json({success:false , message:"product not found"})
        }
        return res.status(200).json({success:true , message:"product deleted"})
    }catch(e){
        return res.status(500).json({success:false , message:e.message});
    }
})


app.put('update/product/:id', isAuthenticated , async(req, res) =>{
    try{
        const product = await Product.findByIdAndUpdate(req.params.id ,{
            name:req.body.name,
            description:req.body.description,
            price: req.body.price,
            stock: req.body.stock

        },
        {new:true}
        );
        if(!product){
            return res.status(401).json({success:false , message:"product not found"})
        }
        return res.status(200).json({success:false , message:"product update sucessfully"})


    }catch(err){
        return res.status(500).json({success:false , message:err.message});

    }
})



/**
 * //User Sends the list productIds 
   // Create a Order with those products and total of sum of product prices
 * @param {Ids} Array Id of the Product/s 
 */
app.post("/product/buy", isAuthenticated, async (req, res) => {
    const { ids } = req.body;
    const products = await Product.find({ _id: { $in: ids } });
    //Sending Products with Details to create the Order to the Queue with Buffer Data
    channel.sendToQueue("ORDER", Buffer.from(JSON.stringify({ products, userEmail: req.user.email })));
    //Consuming Product Channel to get the Acknowledgment of the Order Creation
    channel.consume("PRODUCT", (data) => {
        let recivedOrderAcknowledgment = JSON.parse(data.content)
        console.log('consuming Product',recivedOrderAcknowledgment);
        order = recivedOrderAcknowledgment
        channel.ack(data)

    })

    return res.send(order)


})



/**
 * Listens the server at Proviced Port 
 */
app.listen(PORT, () => {
    console.log(`Product-Service at ${PORT}`);
})