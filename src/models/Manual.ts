import mongoose, {  Schema } from 'mongoose';

export interface Page {
    pageNumber: number;
    mdText: string;
    hasImg: boolean;
    imgUrl?: string;
}
export interface IManual {
    pages: Page[];
}

const ManualSchema: Schema = new Schema(
    {
        pages: [{
            pageNumber: { type: Number, required: true },
            mdText: { type: String, required: true },
            hasImg: { type: Boolean, required: true },
            imgUrl: { type: String, required: false }
        }]
    }, 
    {
        timestamps: true,
        collection: 'manuals',
    }
)

export default mongoose.model<IManual>('Manual', ManualSchema);