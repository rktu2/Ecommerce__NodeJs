const express = require('express');
const app = express();
const cors  =require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const User = require('./user.schema')
const jwt = require("jsonwebtoken")
const dotenv = require('dotenv');
const helmet = require('helmet');
const xss = require('xss-clean');
dotenv.config();


app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
app.use(xss());

const PORT = process.env.PORT_ONE || 7070;
//Connecting With Productservice Database 
//Note:- Please Update the mongoURL as it suits you with Local or the MongoDB Atlas URL
mongoose.connect("mongodb://localhost:27017/customerservice", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Successfully connected to the databasedatabase(CustomerService)");
}).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
});



/**
 * Signin Users with Providing teh JWT Token
 * @param {email} String Email of the User 
 * @param {password} String Password of the User
 */
app.post('/customer/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email });

        if (user == null) {
            return res.json({ message: "User Doesn't Exist" });
        } else {
            if (user.password !== password) {
                return res.json({ message: "Incorrect Password" });
            }

            const payload = { email, name: req.body.name }
            jwt.sign(payload, "secret", (err, token) => {
                if (err) return console.log(err);
                else {
                    return res.send({ token: token });
                }
            })
        }

    } catch (err) {
        console.log('Error', err);
    }
});


/**
 * Creates/Registers User 
 * @param {email} String Name of the User 
 * @param {password} String Name of the User
 * @param {name} Name Name of the User
 */
app.post('/customer/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const userExists = await User.findOne({ email: email });
        if (userExists) {
            return req.json({ message: 'User Already Exist' });
        } else {
            const newUser = new User({ email, name, password });
            newUser.save()
            return res.send(newUser)
        }
    } catch (err) {
        console.log('Error', err);
    }
});


/**
 * Listens the server at Proviced Port 7070
 */
app.listen(PORT, () => {
    console.log(`Customer-Service at ${PORT}`);
})