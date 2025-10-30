const { get } = require("mongoose");
const Category = require("../../models/CategorySchema");
const Product = require("../../models/ProductSchema")



const categoryInfo = async(req,res)=>{
    try {
        const page = parseInt(req.query.page)||1;
        const limit = 6;
        const skip = (page-1)*limit;
        const search = req.query.search || ''; 

        // Build search query
        const searchQuery = search 
            ? { name: { $regex: search, $options: 'i' } } 
            : {};

        const categoryData = await Category.find(searchQuery)
            .sort({createdAt:-1})
            .skip(skip)
            .limit(limit)

        const totalCategories = await Category.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCategories/limit)
        
        res.render("category",{
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: search  
        })
        
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror")
    }
}

const loadAddCategory = (req, res) => {
  try {
    return res.render("addcategory");
  } catch (error) {
    return res.send("Error in loading add category");
  }
};




const addCategory = async(req,res)=>{
    console.log("Add Category Invocked");
     console.log(" REQ BODY:", req.body);
    const {name,description} = req.body;
    try {
        const existingCategory = await Category.findOne({name})
        if(existingCategory){
            return res.status(400).json({error:"Category already exists"})
        }


        const newCategory = new Category({
            name,
            description
        })

        await newCategory.save();
        return res.json({message:"Category added Successfully"})
    } catch (error) {
        console.log("error",error)
        return res.status(500).json({error:"Internal Server Error"})
        
    }
}




const getListCategory = async(req,res)=>{
    try {
        
let id = req.query.id;
await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect("/admin/category")

    } catch (error) {
        res.redirect("/pageerror")
        
    }
}

const getUnlistCategory = async (req,res)=>{
    try {
        const id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect("/admin/category")

    } catch (error) {
        res.redirect("/pageerror")
    }
}



const getEditCategory = async (req,res)=>{
    try {
        
        const id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("edit-category",{category:category})

    } catch (error) {
        res.redirect("/pageerror")
    }
}


const editCategory = async (req,res)=>{
    try {
        const id = req.params.id;
        const {categoryName,description,image}=req.body;
        const existingCategory = await Category.findOne({name:categoryName})
        if(existingCategory){
            return res.status(400).json({error:"Category exists, Please choose another name"})
        }

        const updateCategory = await Category.findByIdAndUpdate(id,{
            name:categoryName,
            description:description,
        },{new:true})


        if(updateCategory){
            res.redirect("/admin/category");
        }else{
            res.status(404).json({error:"Category not found"})
        }
        } catch (error) {
        res.status(500).json({error:"Internal Server Error"})
    }
}

module.exports = {
    categoryInfo,
    addCategory,
    loadAddCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
}