const User = require("../../models/userSchema.js");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt")


const pageerror= async(req,res)=>{
    res.render("admin-error")
}


const loadLogin =  (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}

const login = async (req,res)=>{
    try {
        const {email,password} = req.body;
        const admin = await User.findOne({email:email,isAdmin:true})
       
        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password);
            if(passwordMatch){

                req.session.admin = true;
                console.log("Admin session set:", req.session.admin);

                return res.redirect("/admin/dashboard")
            }else{
                return res.redirect("admin-login")
            }
        }else{
            return res.redirect("admin-login")
        }
    } catch (error) {
        console.log("login error",error);
        return res.redirect("/p-404")
    }
}


const loadDashboard = async(req,res)=>{
    if(req.session.admin){
    try {
        res.render("dashboard");
    } catch (error) {
       res.redirect("/pageNotFound") 
    }

}else{
    return res.redirect("/login");
}
}

const logout = async (req, res) => {
    try {
        req.session.destroy((error) => {
            if (error) {
                console.log("Error destroying session",error);
                return res.redirect("/pageError");
            }
            res.redirect("/admin/login");
        });
    } catch (error) {
        console.log("Unexpected error during logout",error);
        res.redirect("/pageError");
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,

}