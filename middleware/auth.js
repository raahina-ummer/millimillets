const User = require("../models/userSchema")
const user = require("../models/userSchema")


const userAuth = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.redirect('/logIn');
        }

        const userData = await User.findById(req.session.user);
        if (!userData) {
          req.session.destroy();
          return res.redirect('/login');
      }

        if (userData && !userData.isBlocked) {
            req.user = userData; 
            req.session.user = userData;
            return next();
        }
        req.session.destroy((err) => {
            if (err) console.error('Session destruction error:', err);
        });
        
        return res.redirect('/login');

    } catch (error) {
      console.error("Error in user Auth Middleware:", error);
      if (error.name === 'CastError') {
          return res.redirect('/login');
      }
      res.status(500).send("Internal Server Error");
  }
};

const adminAuth = async (req, res, next) => {
  if (req.session.admin) {
    try {
      const admin = await User.findOne({ isAdmin: true });
      if (admin) {
        return next();
      } else {
        return res.redirect("/admin/login");
      }
    } catch (error) {
      console.log("Error on admin Auth Middleware", error);
      res.status(500).send("Internel server Problem");
    }
  } else {
    res.redirect("/admin/login");
  }
};


// const userAuth = (req,res,next)=>{
//     if(req.session.user){
//         User.findById(req.session.user)
//         .then(data=>{
//             if(data && !data.isBlocked){
//                 next();
//             }else{
//                 res.redirect("/login")
//             }
//         })
//         .catch(error=>{
//             console.log("Error in user auth middleware");
//             res.status(500).send("Internal Server error");
//         })
//     }else{
//         res.redirect("/login")
//     }
// }




// const adminAuth = (req,res,next)=>{
//     User.findOne({isAdmin:true})
//     .then(data=>{
//         if(data){
//             next();
//         }else{
//             res.redirect("/admin/login")
//         }
//     })
//     .catch(error=>{
//         console.log("Error in adminauth middleware",error);
//         res.status(500).send("Internal Server Error")
//     })
// }



module.exports= {
    userAuth,
    adminAuth
}
