import mongoose, { Schema } from 'mongoose';

export interface IProductSku{
    code: string; // SKU code
    item_no?: string;
    product_name?: string;
    warranty?: string;
    saleprice?: string;
    group_name?: string;
    menu_name?: string;
    spec?: string;
    feature?: string;
    model?: string;
    brand?: string;
    pic_?: string;
    manual_id?: string; 
}

const productSkuSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, // SKU code
    item_no: String,
    product_name: String,
    warranty: String,
    saleprice: String,
    group_name: String,
    menu_name: String,
    spec: String,
    feature: String,
    model: String,
    brand: String,
    pic_: String,
    manual_id: { type: Schema.Types.ObjectId, ref: 'Manual' }
});

export const ProductSku = mongoose.model("ProductSku", productSkuSchema);