const Sequelize = require("sequelize");
const Op = Sequelize.Op;

/*

    Created By : Elliot Francis
    Description : A generic REST endpoint generator the leverages Sequelize ORM model definitions to
    auto generate a set of endpoints for a given model. Backs a custom internal adminstrative UI.

*/

class SeqREST {
    constructor(app, database, model, base_route, options) {
        if (typeof app !== "function") { throw new Error("Connecting App Missing"); }
        if (typeof model !== "string" || typeof database.models[model] == "undefined") { throw new Error("Source Model Missing"); }
        if (typeof base_route !== "string") { throw new Error("Bad Base Route Definition"); }
        if (typeof options == "undefined") { options = {}; }

        this.bindRoutes = this.bindRoutes.bind(this);
        this.getSchema = this.getSchema.bind(this);
        this.getList = this.getList.bind(this);
        this.get = this.get.bind(this);
        this.getBlank = this.getBlank.bind(this);
        this.getOne = this.getOne.bind(this);
        this.getMany = this.getMany.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.delete = this.delete.bind(this);
        this.deleteOne = this.deleteOne.bind(this);
        this.deleteMany = this.deleteMany.bind(this);
        this.deriveSchema = this.deriveSchema.bind(this);
        this.deriveRelationships = this.deriveRelationships.bind(this);
        this.getPrimaryKey = this.getPrimaryKey.bind(this);
        this.database = database;
        this.model = database.models[model];
        this.options = options;
        this.primaryKey = this.getPrimaryKey(database.models[model]);
        this.excludedFields = ["password_hash", "password"]
        this.bindRoutes(app, database.models[model], base_route, options)
        return this;
    }

    bindRoutes(app, model, base_route, options) {
        // Bind Resource Routes
        const resource_route = `${base_route}/${model.tableName}`
        let authMiddleware = (_req, _res, next) => { next(); }
        if (typeof options.auth == "function") {
            authMiddleware = (req, res, next) => {
                options.auth(req, res, next);
            }
        }
        app.get(`${base_route}/schema/${model.tableName}`, authMiddleware, this.getSchema);
        app.get(resource_route, authMiddleware, this.getList);
        app.get(`${resource_route}/:record_ids`, authMiddleware, this.get);
        app.post(resource_route, authMiddleware, this.create);
        app.put(resource_route, authMiddleware, this.update);
        app.delete(`${resource_route}/:record_ids`, authMiddleware, this.delete);
    }

    getPrimaryKey(model) {
        return Object.keys(model.tableAttributes).reduce((pk, field_key) => {
            let field = this.model.tableAttributes[field_key];
            if (field.primaryKey === true) { return field.fieldName; }
            return pk;
        }, null)
    }

    deriveSchema(model) {
        
        let schemaPrimaryKey = null;
        let schemaObject = Object.keys(model.tableAttributes).map((field_key) => {
            
            let field = this.model.tableAttributes[field_key];

            let type = "Unknown";
            if (field.type instanceof Sequelize.STRING) { type = "string" }
            if (field.type instanceof Sequelize.TEXT) { type = "text" }
            if (field.type instanceof Sequelize.BOOLEAN) { type = "boolean" }
            if (field.type instanceof Sequelize.INTEGER) { type = "integer" }
            if (field.type instanceof Sequelize.BIGINT) { type = "integer" }
            if (field.type instanceof Sequelize.FLOAT) { type = "float" }
            if (field.type instanceof Sequelize.DOUBLE) { type = "double" }
            if (field.type instanceof Sequelize.DATE) { type = "datetime" }
            if (field.type instanceof Sequelize.DATEONLY) { type = "date" }
            let field_object = {
                fieldName: field.fieldName,
                type: type
            }
            if (field.primaryKey === true) { field_object.primaryKey = field.primaryKey; schemaPrimaryKey = field.fieldName; }
            return field_object
        })

        let target_columns = [];

        let associations = Object.keys(model.associations).map(( association_key ) => {
            let association = this.model.associations[association_key];
            
            const target_primary_key = Object.keys(association.target.tableAttributes).reduce((tk, attr_key) => {
                const attr = association.target.tableAttributes[attr_key];
                if (attr.primaryKey == true) { return attr.fieldName; }
                return tk;
            }, null)
            let target_key = association.options.targetKey || target_primary_key;
            let foreign_key = association.options.foreignKey;
        
            if (["HasOne", "BelongsTo"].includes(association.associationType) ) {
                target_columns.push(foreign_key);
            }

            let searchKeys = Object.keys(association.target.tableAttributes).map((key) => { 
                const field = association.target.tableAttributes[key]
                return field.fieldName; 
            }).filter((k) => { return !["createdAt", "deletedAt", "updatedAt", "password", "password_hash"].includes(k); })
            let label_keys = {};
            if (typeof this.options.label_keys == "object") { label_keys = this.options.label_keys; }
            return { 
                fieldName: association.target.tableName, 
                type: association.associationType, 
                association: { 
                    model: association.target.tableName, 
                    target_key: target_key, 
                    foreign_key: foreign_key, 
                    label_key: label_keys[association.target.tableName],
                    name: association.options.name,
                    searchable_keys: searchKeys
                } };
        })

        return schemaObject.filter((col) => {
            if(target_columns.includes(col.fieldName) && col.primaryKey !== true) { return false; }
            return true;
        }).concat(associations);
    }

    deriveRelationships(model) {

        let schemaPrimaryKey = null;
        let schemaObject = Object.keys(model.tableAttributes).map((field_key) => {
            let field = this.model.tableAttributes[field_key];
            let type = "Unknown";
            if (field.type instanceof Sequelize.STRING) { type = "string" }
            if (field.type instanceof Sequelize.TEXT) { type = "text" }
            if (field.type instanceof Sequelize.BOOLEAN) { type = "boolean" }
            if (field.type instanceof Sequelize.INTEGER) { type = "integer" }
            if (field.type instanceof Sequelize.BIGINT) { type = "integer" }
            if (field.type instanceof Sequelize.FLOAT) { type = "float" }
            if (field.type instanceof Sequelize.DOUBLE) { type = "double" }
            if (field.type instanceof Sequelize.DATE) { type = "datetime" }
            if (field.type instanceof Sequelize.DATEONLY) { type = "date" }
            let field_object = {
                fieldName: field.fieldName,
                type: type
            }
            if (typeof field.references == "object") { field_object.references = field.references }
            if (field.primaryKey === true) { field_object.primaryKey = field.primaryKey; schemaPrimaryKey = field.fieldName; }
            return field_object
        })

        return schemaObject.filter((row) => {
            if (typeof row.references == "object") { return true; }
            return false;
        }).map((row) => {
            return row.references;
        })
    }

    getSchema(req, res, next) {
        const fields = this.deriveSchema(this.model)
        res.status(200).send({ schema: fields });
        return Promise.resolve({ schema: fields });
    }

    getList(req, res, next) {
        let query = req.query;
        let criteria = {};
        let excludedFields = this.excludedFields;
        // Note : Required to ensure functionality of MSSQL Servers for LIMIT and FETCH BY issues in Sequelize
        // See: https://github.com/tediousjs/tedious/issues/872
        let ordering = [[this.primaryKey, "ASC"]];

        
        let pagination = {};
        try { pagination = JSON.parse(query.pagination) } catch (err) {}
        let limit = parseInt(pagination.perPage, 10) || 20;
        let page = parseInt(pagination.page, 10) || 1;
        let offset = (page - 1) * limit;
        
        if (typeof query["sort"] == "string") {
            
            let sorting = {};
            try { sorting = JSON.parse(query["sort"]) } catch (err) {}
            if (Object.keys(sorting).length > 0) {
                if( typeof sorting.field == "string" && typeof sorting.order == "string" ) {
                    ordering = [[sorting.field, sorting.order]];
                }
            }
        }

        let associations = this.deriveRelationships(this.model);
        let associationMap = {};
        let includeModels = associations.map((column) => {
            associationMap[column.model] = this.database.models[column.model];
            return { model: this.database.models[column.model], attributes: { exclude: excludedFields } };
        });


        if (typeof query.filter == "string") {
            let filter = {};
            try { filter = JSON.parse(query.filter) } catch (err) {}
            if(Object.keys(filter).length > 0) {
                let filter_column = Object.keys(filter)[0];
                let filter_value = filter[filter_column];
                if(`${filter_value}`.length > 0) {

                    if(typeof associationMap[filter_column] !== "undefined") {
                    
                        const label_key = this.options.label_keys[filter_column];
                        let includeIndex = includeModels.reduce((ti, r, i) => { 
                            if(r.model.tableName == filter_column) { return i; }; return ti; 
                        }, -1)
                        let includeModel = includeModels[includeIndex]["model"];
                        let includeWhere = {};
                        includeWhere[label_key] = filter_value;
                        if (includeModel.tableAttributes[label_key]["type"] instanceof Sequelize.STRING) {
                            includeWhere[label_key] = { [Op.like]: `%${filter_value}%` };
                        }
                        if (includeModel.tableAttributes[label_key]["type"] instanceof Sequelize.TEXT) {
                            includeWhere[label_key] = { [Op.like]: `%${filter_value}%` };
                        }
                        includeModels[includeIndex]["where"] = includeWhere;

                    } else {
                        criteria[filter_column] = filter_value;
                        if (this.model.tableAttributes[filter_column]["type"] instanceof Sequelize.STRING) {
                            criteria[filter_column] = { [Op.like]: `%${filter_value}%` };
                        }
                        if (this.model.tableAttributes[filter_column]["type"] instanceof Sequelize.TEXT) {
                            criteria[filter_column] = { [Op.like]: `%${filter_value}%` };
                        }
                    }
                }    
            }
            
        }
        return this.model.findAndCountAll({ where: criteria, include: includeModels, limit: limit, offset: offset, order: ordering }).then((results) => {
            let records = results.rows.map((r) => { return r.get({ plain: true }); });
            res.status(200).send({ data: records, total: results.count });
            return { data: records, total: results.count };
        }).catch((err) => {
            res.status(500).send(err.message || err);
            return err;
        })
        
    }
    downloadList(req, res, next) {

    }
    get(req, res, next) {
        if (req.params.record_ids == "null") {    
            return this.getBlank(req, res, next);
        } else {
            let ids = `${req.params.record_ids}`.split(",").map((id) => { return parseInt(id, 10); })
            if (ids.length > 1) { return this.getMany(req, res, next) }
            return this.getOne(req, res, next)
        }
    }

    getBlank(req, res, next) {
        let record = this.model.build({});
        res.status(200).send({ data: record.get({ plain: true }) });
        return { data: record.get({ plain: true }) };
    }

    getOne(req, res, next) {
        let record_id = parseInt(req.params.record_ids, 10);
        let excludedFields = this.excludedFields;
        let whereObject = {};
        whereObject[this.getPrimaryKey(this.model)] = record_id;
        return this.model.findOne({ where: whereObject, attributes: { exclude: excludedFields } }).then((record) => {
            res.status(200).send({ data: record.get({ plain: true }) });
            return { data: record.get({ plain: true }) };
        }).catch((err) => {
            res.status(500).send(err.message || err);
            return err;
        })
    }
    getMany(req, res, next) {
        let excludedFields = this.excludedFields;
        let ids = `${req.params.record_ids}`.split(",").map((id) => { return parseInt(id, 10); })
        let whereObject = {};
        whereObject[this.getPrimaryKey(this.model)] = ids;
        return this.model.findAll({ where: whereObject, attributes: { exclude: excludedFields } }).then((rows) => {
            let records = rows.map((r) => { return r.get({ plain: true }); });
            res.status(200).send({ data: records });
            return { data: records };
        }).catch((err) => {
            res.status(500).send(err.message || err);
            return err;
        })
    }
    async create(req, res, next) {
        let data = req.body.data;
        if(typeof this.options.beforeCreate == "function") { data = await this.options.beforeCreate(data, this.model); }
        if(data === false) { 
            res.status(500).send({ type: "RecordAbort", data: "beforeCreate returned false. Record creation aborted." });
            return err;
        }
        return this.model.create(data).then((newRecord) => {
            res.status(200).send({ data: newRecord });
            return { data: newRecord };
        }).catch((err) => {
            if (err.name == "SequelizeValidationError") {
                const errors = err.errors.map((e) => {
                    return e.message;
                });
                res.status(500).send({ type: err.name, data: errors });
                return err;
            }
            res.status(500).send({ type: "GeneralError", data: (err.message || err) });
            return err;
        })
    }
    async update(req, res, next) {
        let data = req.body.data;
        if(typeof this.options.beforeUpdate == "function") { data = await this.options.beforeUpdate(data, this.model); }
        if (data === false) {
            res.status(500).send({ type: "RecordAbort", data: "beforeUpdate returned false. Record update aborted." });
            return err;
        }
        let whereObject = {};
        whereObject[this.getPrimaryKey(this.model)] = data[this.getPrimaryKey(this.model)];
        return this.model.findOne({ where: whereObject }).then((record) => {
            return record.update(data)
        }).then((updatedRecord) => {
            res.status(200).send({ data: updatedRecord });
            return { data: updatedRecord };
        }).catch((err) => {
            if (err.name == "SequelizeValidationError") {
                const errors = err.errors.map((e) => {
                    return e.message;
                });
                res.status(500).send({ type: err.name, data: errors });
                return err;
            }
            res.status(500).send({ type: "GeneralError", data: (err.message || err)});
            return err;
        })
    }
    delete(req, res, next) {
        let ids = `${req.params.record_ids}`.split(",").map((id) => {return parseInt(id, 10); })
        if (ids.length > 1) { return this.deleteMany(req, res, next) }
        return this.deleteOne(req, res, next)
    }
    async deleteOne(req, res, next) {
        let record_id = parseInt(req.params.record_ids, 10);
        let whereObject = {};
        whereObject[this.getPrimaryKey(this.model)] = record_id;
        return this.model.destroy({ where: whereObject }).then((record) => {
            res.status(200).send({ data: null });
            return { data: null };
        }).catch((err) => {
            res.status(500).send(err.message || err);
            return err;
        })
    }
    deleteMany(req, res, next) {
        let ids = `${req.params.record_ids}`.split(",").map((id) => { return parseInt(id, 10); })
        let whereObject = {};
        whereObject[this.getPrimaryKey(this.model)] = ids;
        return this.model.destroy({ where: whereObject }).then((rows) => {
            res.status(200).send({ data: ids });
            return { data: ids };
        }).catch((err) => {
            res.status(500).send(err.message || err);
            return err;
        })
    }
}

module.exports.SeqREST = SeqREST
module.exports.Resource = (app, database, model, base_route, options) => {
    return new SeqREST(app, database, model, base_route, options)
} 