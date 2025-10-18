// const Category = require("../../models/CategorySchema");



// const categoryInfo = async(req,res)=>{
//     try {
//         const page = parseInt(req.query.page)||1;
//         const limit =3;
//         const skip = (page-1)*limit;

//         const categoryData = await Category.find({}
//             .sort({createAt:-1})
//             .skip(skip)
//             .limit(limit)
//         )
//     } catch (error) {
        
//     }
// }
