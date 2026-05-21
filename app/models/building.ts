import mongoose, { Document, Schema } from 'mongoose';

interface IBuilding extends Document {
    id: string;
    name: string;
    address: object;
    verified: boolean;
}

// Define schema for building items
const BuildingSchema = new Schema<IBuilding>({
    id: {
        type: String
    },
    name: {
        type: String
    },
    address: {
        type: Object
    },
    verified: {
        type: Boolean
    }
});

BuildingSchema.index({ id: 1 }, { unique: true });

const building = mongoose.model<IBuilding>('building', BuildingSchema);

export default building;
