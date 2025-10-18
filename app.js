const express = require("express")
const path = require("path")
const env = require("dotenv").config()
const session = require("express-session");
const passport = require("./config/passport.js")
const db = require("./config/db.js")
const userRouter = require("./Routes/userRouter.js");
const adminRouter = require("./Routes/adminRouter.js");


db()


const app = express();

app.use(express.json()); //middleware to convert formdata to json 
app.use(express.urlencoded({extended :true}));  //convert querystrng data
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))


app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
    res.set("cache-control","no-store")
    next();
})



app.set("view engine" ,"ejs") //configure ejs
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,"views/admin")]); //mentioning where is the views folder
app.use(express.static(path.join(__dirname, "public"))); //to serve static files

app.use("/",userRouter) //specify user route
app.use("/admin",adminRouter) //handle all request that comes to admin route


app.listen(process.env.PORT,()=>{
    console.log("Server created Sucessfully!!")
})



module.exports = app;