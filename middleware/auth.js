const User = require("../models/userSchema")
// const user = require("../models/userSchema")




const userAuth = async (req,res,next)=>{
    try {
        // const userId = req.session?.user?.id;
        const userId = req.session?.user?._id || req.session?.user?.id;
        if(!userId){
            return res.redirect("/login");
        }

        const user = await User.findOne({_id:userId,isBlocked:false});
        if(!user)
        {
            return res.redirect("/login");
        }
        next();
    } catch (error) {
        console.log(error);
        
    }
}







// const userAuth = (req, res, next) => {
//   if (req.session.user) {
//      User.findById(req.session.user)
//       .then(data => {
//         if (data && !data.isBlocked) {
//           //  User exists and is not blocked — proceed
//           next();
//         } else {
//           //  User blocked or not found — redirect
//           req.session.destroy;
//           res.redirect("/login");
//         }
//       })
//       .catch(error => {
//         console.log("Error in user auth middleware:", error);
//         res.status(500).send("Internal Server Error");
//       });
//   } else {
//     // No session user — redirect to login
//     res.redirect("/login");
//   }
// };


const adminAuth = (req,res,next)=>{
    try{
        if(!req.session?.admin)
        {
            return res.redirect("/admin/login");
        }
        next();

    }catch(error){
        console.log(error);


    }
}


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
