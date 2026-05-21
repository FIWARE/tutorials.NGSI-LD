import Building from '../models/building';

class BuildingUpdate {
    private model: typeof Building;

    constructor(model: typeof Building) {
        this.model = model;
    }

    upsert(id: string, name: string, address: object, verified = false) {
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

    findById(id: string) {
        return this.model.findOne({ id });
    }

    deleteById(id: string) {
        return this.model.findOneAndDelete({ id });
    }

    updateById(id: string, object: { name: string; address: object; verified: boolean }) {
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

export default new BuildingUpdate(Building);
