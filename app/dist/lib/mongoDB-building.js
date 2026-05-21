"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const building_1 = __importDefault(require("../models/building"));
class BuildingUpdate {
    constructor(model) {
        this.model = model;
    }
    upsert(id, name, address, verified = false) {
        const newBuilding = {
            id,
            name,
            address,
            verified
        };
        return this.model.findOneAndUpdate({ id }, newBuilding, { upsert: true });
    }
    findAll() {
        return this.model.find();
    }
    findById(id) {
        return this.model.findOne({ id });
    }
    deleteById(id) {
        return this.model.findOneAndDelete({ id });
    }
    updateById(id, object) {
        const query = { id };
        return this.model.findOneAndUpdate(query, {
            $set: {
                name: object.name,
                address: object.address,
                verified: object.verified
            }
        });
    }
}
exports.default = new BuildingUpdate(building_1.default);
