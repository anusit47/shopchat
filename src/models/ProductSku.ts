import mongoose, { Document, Schema } from 'mongoose';

export interface IProductSku extends Document {
  code: string;
  product_name: string;
  warranty: string;
  saleprice: string;
  brand: string;
  modelName: string;
  spec?: string;
}

const ProductSkuSchema: Schema = new Schema({
  code: { type: String, required: true, unique: true },
  product_name: { type: String, required: true },
  warranty: { type: String },
  saleprice: { type: String, required: true },
  brand: { type: String },
  modelName: { type: String },
  spec: { type: String }
}, { timestamps: true });

export default mongoose.model<IProductSku>('ProductSku', ProductSkuSchema);
