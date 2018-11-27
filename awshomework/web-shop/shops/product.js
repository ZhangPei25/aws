'use strict';

const uuid = require('uuid/v1')
const aws = require('aws-sdk')

const dynamo = new aws.DynamoDB()

const errors = {
    missing_body: { code: 400, msg: 'Error: empty request' },
    json: { code: 400, msg: 'Error: JSON format' },
    missing_params: { code: 400, msg: 'Error: missing parameters' },
    wrong_params: { code: 400, msg: 'Error: invalid parameters' },
    wrong_param_format: { code: 400, msg: 'Error: invalid id' },
    wrong_param_format: { code: 400, msg: 'Error: parameters in wrong format' },
    db_error: { code: 500, msg: 'Error: database could not process request' },
    item_error: { code: 400, msg: 'Error: there is no this item in database' }
}
const error = (cb, errv) => {
    const err = errors[errv]
    cb(null, {
        statusCode: err.code || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: err.msg || 'Error'
    })
}
const ok = (cb, obj) => {
    cb(null, {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obj)
    })
}

module.exports.productCreate = (event, context, cb) => {

    if (!event.body)
        return error(cb, 'missing_body')

    let data
    try { data = JSON.parse(event.body) } catch (e) { return error(cb, 'json') }

    if (!data.name || !data.shop_id || !data.price)
        return error(cb, 'missing_params')

    if ((typeof data.name !== 'string') || (typeof data.shop_id !== 'string') || (typeof data.price !== 'number'))
        return error(cb, 'wrong_param_format')

    if (!data.shop_id.match(/^[a-f0-9]{8,8}(\-[a-f0-9]{4,4}){3,3}\-[a-f0-9]{12,12}$/))
        return error(cb, 'wrong_id_format')

    const id = uuid()
    dynamo.putItem({
        TableName: 'products',
        Item: {
            id: { S: id },
            shop_id: { S: data.shop_id },
            name: { S: data.name },
            price: { N: data.price.toString() }
        }
    }, (err, res) => {
        if (err)
            cb(null, { statusCode: 504, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(err) })
        else
            ok(cb, { id: id, shop_id: data.shop_id, name: data.name, price: data.price })
    })
};

module.exports.productGetAll = (event, context, cb) => {

    dynamo.scan({
        TableName: 'products',
    }, (err, data) => {
        if (err) {
            cb(null, { statusCode: 504, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(err) })
        } else {
            ok(cb, {
                count: data.Count,
                products: data.Items.map(item => ({
                    id: item.id.S,
                    shop_id: item.shop_id.S,
                    name: item.name.S,
                    price: Number(item.price.N)
                }))
            })
        }
    })
};
module.exports.productGet = (event, context, cb) => {
    if (!event.pathParameters || !event.pathParameters.id)
        return error(cb, 'missing_params')

    let id = event.pathParameters.id

    if (!id.match(/^[a-f0-9]{8,8}(\-[a-f0-9]{4,4}){3,3}\-[a-f0-9]{12,12}$/))
        return error(cb, 'wrong_id_format')

    dynamo.getItem({
        TableName: 'products',
        Key: {
            "id": { S: id },
        }
    }, (err, res) => {
        if (err) {
            error(cb, 'db_error')
        } else {
            if (!res.Item) {
                error(cb, 'item_error')
            } else {
                ok(cb, { id: id, shop_id: res.Item.shop_id.S, name: res.Item.name.S, price: Number(res.Item.price.N) })
            }
        }
    })
};

module.exports.productUpdate = (event, context, cb) => {

    if (!event.pathParameters || !event.pathParameters.id || !event.body)
        return error(cb, 'missing_body')

    let data
    try { data = JSON.parse(event.body) } catch (e) { return error(cb, 'json') }

    let id = event.pathParameters.id
    if (!id.match(/^[a-f0-9]{8,8}(\-[a-f0-9]{4,4}){3,3}\-[a-f0-9]{12,12}$/))
        return error(cb, 'wrong_id_format')

    if (!data.name && !data.price) {
        return error(cb, 'missing_params')
    }
    if (data.price <= 0) {
        return error(cb, 'wrong_params')
    }

    let expressAttrNames = {}
    let expressAttrValues = {}
    let updateExpress = []

    if (data.name) {
        expressAttrNames['#N'] = 'name'
        expressAttrValues[':namevalue'] = { S: data.name }
        updateExpress.push('#N = :namevalue')
    }

    if (data.price) {
        expressAttrNames['#P'] = 'price'
        expressAttrValues[':pricevalue'] = { N: data.price.toString() }
        updateExpress.push('#P = :pricevalue')
    }

    dynamo.getItem({
        TableName: 'products',
        Key: {
            "id": { S: id },
        }
    }, (err, res) => {
        if (err) {
            error(cb, 'db_error')
        } else {
            if (!res.Item) {
                error(cb, 'item_error')
            } else {
                dynamo.updateItem({
                    TableName: 'products',
                    ExpressionAttributeNames: expressAttrNames,
                    ExpressionAttributeValues: expressAttrValues,
                    Key: {
                        "id": { S: id },
                    },
                    UpdateExpression: 'SET ' + updateExpress.join(','),
                    ReturnValues: 'ALL_NEW',
                }, (err, res) => {
                    if (err)
                        cb(null, { statusCode: 504, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(err) })

                    else {
                        ok(cb, { id: id, shop_id: res.Attributes.shop_id.S, name: res.Attributes.name.S, price: Number(res.Attributes.price.N) })
                    }
                })
            }
        }
    })
};

module.exports.productDelete = (event, context, cb) => {
    if (!event.pathParameters || !event.pathParameters.id)
        return error(cb, 'missing_params')

    let id = event.pathParameters.id

    if (!id.match(/^[a-f0-9]{8,8}(\-[a-f0-9]{4,4}){3,3}\-[a-f0-9]{12,12}$/))
        return error(cb, 'wrong_id_format')

    dynamo.getItem({
        TableName: 'products',
        Key: {
            "id": { S: id },
        }
    }, (err, res) => {
        if (err) {
            error(cb, 'db_error')
        } else {
            if (!res.Item) {
                error(cb, 'item_error')
            } else {
                dynamo.deleteItem({
                    TableName: 'products',
                    Key: { id: { S: id } },
                    ReturnValues: "ALL_OLD"
                }, (err, res) => {
                    if (err) {
                        error(cb, 'db_error')
                    } else {
                        if (!res.Attributes.id) {
                            error(cb, 'item_error')
                        } else {
                            ok(cb, { msg: 'delete item successfully!' })
                        }
                    }
                })
            }
        }
    })
};

module.exports.productList = (event, contest, cb) => {
    if (!event.pathParameters || !event.pathParameters.id)
        return error(cb, 'missing_params')

    let shop_id = event.pathParameters.id

    if (!shop_id.match(/^[a-f0-9]{8,8}(\-[a-f0-9]{4,4}){3,3}\-[a-f0-9]{12,12}$/))
        return error(cb, 'wrong_id_format')

    dynamo.query({
        TableName: 'products',
        IndexName: 'shopid',

        ExpressionAttributeNames: {
            '#N': 'shop_id'
        },
        ExpressionAttributeValues: {
            ':id': { S: shop_id }
        },
        KeyConditionExpression: '#N = :id'
    }, (err, data) => {
        if (err) {
            cb(null, { statusCode: 504, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(err) })
        } else {
            ok(cb, {
                count: data.Count,
                products: data.Items.map(item => ({
                    id: item.id.S,
                    shop_id: item.shop_id.S,
                    name: item.name.S,
                    price: Number(item.price.N)
                }))
            })
        }
    })
}